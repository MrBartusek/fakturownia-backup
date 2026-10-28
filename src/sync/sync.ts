import { relative } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import chalk from 'chalk';
import { INVOICES_PER_PAGE, type FakturowniaClient } from '../fakturownia/client.ts';
import type { Invoice, InvoiceType } from '../fakturownia/types.ts';
import { Logger } from '../logger.ts';
import { writeAtomic } from './files.ts';
import { LINK_FIELDS, MetadataStore, omit } from './metadata.ts';
import { departmentFolders, FALLBACK_FOLDER, invoicePath } from './paths.ts';
import { scanInvoices } from './scan.ts';
import { loadState, saveState } from './state.ts';

const INVOICE_TYPES: InvoiceType[] = ['income', 'expense'];
const DOWNLOAD_DELAY_MS = 100;

/**
 * Fields that don't affect the PDF. Still saved, so print bumps don't make the listing stop early and miss an edit.
 */
const IGNORED_FIELDS = [
  ...LINK_FIELDS,
  'updated_at',
  'print_time',
  'attachments_count',
  'overdue?',
  'sent_time',
  'email_status',
  'internal_note',
  'category_id',
  'accounting_status',
  'accounting_kind',
  'accounting_vat_tax_date',
  'accounting_income_tax_date',
  'accounting_other_tax_date',
  'exclude_from_accounting',
  'exclude_from_stock_level',
  'not_cost',
  'approval_status',
  'fiscal_status',
  'has_attachments',
  'show_attachments',
  'products_margin',
  'exchange_difference',
];

type SyncContext = {
  client: FakturowniaClient;
  output: string;
  folders: Map<number | null, string>;
  pdfPaths: Map<number, string[]>;
  metadata: MetadataStore;
  counts: { downloaded: number; updated: number; failed: number };
  listedIds: Set<number>;
};

type InvoiceResult = 'downloaded' | 'updated' | 'unchanged';

export type SyncOptions = {
  full: boolean;
};

export async function syncInvoices(client: FakturowniaClient, output: string, options: SyncOptions): Promise<boolean> {
  await setTimeout(DOWNLOAD_DELAY_MS);
  const startTime = performance.now();
  const [state, departments, pdfPaths] = await Promise.all([
    loadState(output),
    client.listDepartments(),
    scanInvoices(output),
  ]);

  const fullListing = options.full || !state.complete || state.failed;
  Logger.info(
    fullListing ? `Starting ${chalk.yellow.bold('full')} invoices sync job...` : 'Starting invoices sync job...',
  );

  const context: SyncContext = {
    client,
    output,
    folders: departmentFolders(departments),
    pdfPaths,
    metadata: new MetadataStore(),
    counts: { downloaded: 0, updated: 0, failed: 0 },
    listedIds: new Set(),
  };
  let finished = false;

  try {
    for (const type of INVOICE_TYPES) {
      await syncInvoiceType(context, type, fullListing);
    }
    finished = true;
  } finally {
    // State first: if the flush below fails too, the next run still knows to list everything
    const now = Math.floor(Date.now() / 1000);
    const succeeded = finished && context.counts.failed === 0;
    const completedNow = fullListing && succeeded;
    await saveState(output, {
      complete: state.complete || completedNow,
      completedAt: completedNow ? now : state.completedAt,
      failed: !succeeded,
      failedAt: succeeded ? state.failedAt : now,
      lastRunAt: now,
    });
    await context.metadata.flush();
  }

  if (fullListing) {
    warnMissing(context);

    if (context.listedIds.size === 0) {
      Logger.warn('No invoices found in this Fakturownia account, nothing to download');
    }
  }

  const { downloaded, updated, failed } = context.counts;
  const elapsedMilliseconds = performance.now() - startTime;
  const seconds = (elapsedMilliseconds / 1000).toFixed(1);

  Logger.info(`Sync done: ${downloaded} downloaded, ${updated} metadata updated, ${failed} failed in ${seconds}s`);

  return failed === 0;
}

async function syncInvoiceType(context: SyncContext, type: InvoiceType, fullListing: boolean) {
  let page = 1;
  while (true) {
    Logger.info(`Fetching page ${page} of ${type} invoices...`);

    const invoices = await context.client.listInvoices(type, page);
    const changed = await syncPage(context, invoices, type);

    const lastPage = invoices.length < INVOICES_PER_PAGE;

    // Invoices come newest change first, so a page without changes means the rest is unchanged too
    const restUnchanged = !fullListing && !changed;
    if (lastPage || restUnchanged) {
      return;
    }

    page++;
  }
}

/**
 * Returns whether anything on the page changed.
 */
async function syncPage(context: SyncContext, invoices: Invoice[], type: InvoiceType): Promise<boolean> {
  let changed = false;

  for (const invoice of invoices) {
    context.listedIds.add(invoice.id);

    try {
      const result = await syncInvoice(context, invoice, type);
      if (result !== 'unchanged') {
        context.counts[result]++;
        changed = true;
      }
    } catch (error) {
      Logger.error(`Failed to sync invoice ${invoice.number}`, error);
      context.counts.failed++;
    }
  }

  await context.metadata.flush();
  return changed;
}

async function syncInvoice(context: SyncContext, invoice: Invoice, type: InvoiceType): Promise<InvoiceResult> {
  const paths = context.pdfPaths.get(invoice.id) ?? [];
  const saved = await context.metadata.find(invoice.id, paths);

  if (saved?.invoice.updated_at === invoice.updated_at) {
    return 'unchanged';
  }

  const label = `${chalk.bold(invoice.number)} ${chalk.yellow(`(${type})`)}`;

  // The PDF stays where it is, even if its folder name would differ now
  if (saved && !pdfDiffers(saved.invoice, invoice)) {
    await context.metadata.set(saved.path, invoice);
    Logger.info(`Updated metadata of ${label}`);
    return 'updated';
  }

  const folder = context.folders.get(invoice.department_id) ?? FALLBACK_FOLDER;
  const path = invoicePath(context.output, folder, invoice);
  const pdf = await context.client.downloadPdf(invoice.id);
  await writeAtomic(path, pdf);

  let movedNote = '';
  if (saved && saved.path !== path) {
    await context.metadata.remove(saved);
    const previousPath = relative(context.output, saved.path);
    movedNote = chalk.gray(` (moved from ${previousPath})`);
  }

  // After `remove()`: a number change keeps the invoice in the same month file under the same id
  await context.metadata.set(path, invoice);

  // The same invoice can come up again later in this run when the listing shifts
  context.pdfPaths.set(invoice.id, [path]);

  const relativePath = relative(context.output, path);
  Logger.info(`Downloaded ${label} to ${chalk.gray(relativePath)}${movedNote}`);

  await setTimeout(DOWNLOAD_DELAY_MS);

  return 'downloaded';
}

function warnMissing(context: SyncContext) {
  for (const [id, paths] of context.pdfPaths) {
    if (context.listedIds.has(id)) {
      continue;
    }
    for (const path of paths) {
      const relativePath = relative(context.output, path);
      Logger.warn(`File ${chalk.gray(relativePath)} no longer exists in the Fakturownia account, consider deleting it`);
    }
  }
}

function pdfDiffers(saved: Invoice, current: Invoice): boolean {
  const savedPdfFields = omit(saved, IGNORED_FIELDS);
  const currentPdfFields = omit(current, IGNORED_FIELDS);
  return !isDeepStrictEqual(savedPdfFields, currentPdfFields);
}
