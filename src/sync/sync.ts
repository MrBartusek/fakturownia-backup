import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import chalk from 'chalk';
import { INVOICES_PER_PAGE, type FakturowniaClient } from '../fakturownia/client.ts';
import type { Invoice, InvoiceType } from '../fakturownia/types.ts';
import { Logger } from '../logger.ts';
import { omit } from '../utils.ts';
import { writeAtomic } from './files.ts';
import { LINK_FIELDS, MetadataStore } from './metadata.ts';
import { attachmentsPath, departmentFolders, FALLBACK_FOLDER, invoicePath, NO_NUMBER_NAME } from './paths.ts';
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
  'attachments',
];

type SyncContext = {
  client: FakturowniaClient;
  output: string;
  folders: Map<number | null, string>;
  pdfPaths: Map<number, string[]>;
  metadata: MetadataStore;
  counts: { downloaded: number; updated: number };
  listedIds: Set<number>;
};

type InvoiceResult = 'downloaded' | 'updated' | 'unchanged';

export type SyncOptions = {
  full: boolean;
};

export async function syncInvoices(client: FakturowniaClient, output: string, options: SyncOptions) {
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
    counts: { downloaded: 0, updated: 0 },
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
    const completedNow = fullListing && finished;
    await saveState(output, {
      complete: state.complete || completedNow,
      completedAt: completedNow ? now : state.completedAt,
      failed: !finished,
      failedAt: finished ? state.failedAt : now,
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

  const { downloaded, updated } = context.counts;
  const elapsedMilliseconds = performance.now() - startTime;
  const seconds = (elapsedMilliseconds / 1000).toFixed(1);

  Logger.info(`Sync done: ${downloaded} downloaded, ${updated} updated in ${seconds}s`);
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

    const result = await syncInvoice(context, invoice, type);
    if (result !== 'unchanged') {
      context.counts[result]++;
      changed = true;
    }
  }

  await context.metadata.flush();
  return changed;
}

async function syncInvoice(context: SyncContext, invoice: Invoice, type: InvoiceType): Promise<InvoiceResult> {
  const paths = context.pdfPaths.get(invoice.id) ?? [];
  const saved = await context.metadata.find(invoice.id, paths);
  const invoiceNumber = chalk.bold(invoice.number ?? NO_NUMBER_NAME);
  const typeColor = type === 'income' ? chalk.blue : chalk.yellow;
  const label = `${invoiceNumber} ${typeColor(`(${type})`)}`;

  const invoiceUpdated = saved?.invoice.updated_at !== invoice.updated_at;
  const pdfChanged = invoiceUpdated && (!saved || pdfDiffers(saved.invoice, invoice));

  // The PDF stays where it is, even if its folder name would differ now
  const folder = context.folders.get(invoice.department_id) ?? FALLBACK_FOLDER;
  const path = saved && !pdfChanged ? saved.path : invoicePath(context.output, folder, invoice);
  const moved = saved && saved.path !== path;

  const zipPath = attachmentsPath(path);
  const zipExists = existsSync(zipPath);
  const hasAttachments = invoice.attachments.length > 0;
  const attachmentsChanged =
    hasAttachments && (!zipExists || !isDeepStrictEqual(saved?.invoice.attachments, invoice.attachments));

  if (!hasAttachments && zipExists) {
    Logger.warn(`File ${chalk.gray(zipPath)} no longer exists in the Fakturownia account, consider deleting it`);
  }

  if (!invoiceUpdated && !attachmentsChanged) {
    return 'unchanged';
  }

  // Metadata comes last, so a failed download makes the next run try the whole invoice again
  if (pdfChanged) {
    const pdf = await context.client.downloadPdf(invoice.id);
    await writeAtomic(path, pdf);

    const movedNote = moved ? chalk.gray(` (moved from ${saved.path})`) : '';
    Logger.info(`Downloaded ${label} to ${chalk.gray(path)}${movedNote}`);

    await setTimeout(DOWNLOAD_DELAY_MS);
  }

  if (attachmentsChanged) {
    const zip = await context.client.downloadAttachments(invoice.id);
    await writeAtomic(zipPath, zip);
    Logger.info(`Downloaded ${invoiceNumber} ${typeColor('(attachments)')} to ${chalk.gray(zipPath)}`);

    if (moved) {
      await rm(attachmentsPath(saved.path), { force: true });
    }

    await setTimeout(DOWNLOAD_DELAY_MS);
  }

  if (moved) {
    await context.metadata.remove(saved);
  }

  // After `remove()`: a number change keeps the invoice in the same month file under the same id
  await context.metadata.set(path, invoice);

  // The same invoice can come up again later in this run when the listing shifts
  context.pdfPaths.set(invoice.id, [path]);

  if (!pdfChanged && !attachmentsChanged) {
    Logger.info(`Updated metadata of ${label}`);
  }

  return pdfChanged ? 'downloaded' : 'updated';
}

function warnMissing(context: SyncContext) {
  for (const [id, paths] of context.pdfPaths) {
    if (context.listedIds.has(id)) {
      continue;
    }
    for (const path of paths) {
      Logger.warn(`File ${chalk.gray(path)} no longer exists in the Fakturownia account, consider deleting it`);
    }
  }
}

function pdfDiffers(saved: Invoice, current: Invoice): boolean {
  const savedPdfFields = omit(saved, IGNORED_FIELDS);
  const currentPdfFields = omit(current, IGNORED_FIELDS);
  return !isDeepStrictEqual(savedPdfFields, currentPdfFields);
}
