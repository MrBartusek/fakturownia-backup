import { rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import chalk from 'chalk';
import type { Invoice } from '../fakturownia/types.ts';
import { Logger } from '../logger.ts';
import { readJson, writeJson } from './files.ts';
import { invoiceFileName } from './paths.ts';

const METADATA_FILE = '.metadata.json';
const METADATA_VERSION = 1;

/**
 * Invoices kept in memory between pages; past this the cache is emptied, so a long first run stays bounded.
 */
const MAX_CACHED_INVOICES = 5_000;

/**
 * Public links to the invoice, never written to the backup, because anyone with them can open the invoice without logging in.
 */
export const LINK_FIELDS = ['token', 'view_url', 'payment_url'];

type MetadataFile = { version: number; invoices: Record<string, Invoice> };
export type SavedInvoice = { path: string; invoice: Invoice };

/**
 * The `.metadata.json` of each month folder, loaded on first use and written back on `flush()`.
 */
export class MetadataStore {
  private readonly months = new Map<string, Map<number, Invoice>>();
  private readonly changedMonths = new Set<string>();
  private pdfsToDelete: string[] = [];

  /**
   * Our PDF of the invoice among `paths` (every PDF with its id): the one its month's metadata lists under that
   * exact file name. More than one PDF with an id only happens when a run was killed in the middle of a move.
   */
  async find(id: number, paths: string[]): Promise<SavedInvoice | undefined> {
    for (const path of paths) {
      const invoices = await this.invoicesIn(dirname(path));
      const invoice = invoices.get(id);
      if (invoice && basename(path) === invoiceFileName(invoice)) {
        return { path, invoice };
      }
    }
    return undefined;
  }

  async set(path: string, invoice: Invoice) {
    const folder = dirname(path);
    const invoices = await this.invoicesIn(folder);
    const invoiceWithoutLinks = omit(invoice, LINK_FIELDS);
    invoices.set(invoice.id, invoiceWithoutLinks);
    this.changedMonths.add(folder);
  }

  /**
   * Deletes our copy of the invoice: its metadata entry now, the PDF on `flush()` after the metadata is written.
   * A crash in between leaves the old PDF with its metadata, which the next run handles as a normal move.
   */
  async remove(saved: SavedInvoice) {
    const folder = dirname(saved.path);
    const invoices = await this.invoicesIn(folder);
    invoices.delete(saved.invoice.id);
    this.changedMonths.add(folder);
    this.pdfsToDelete.push(saved.path);
  }

  async flush() {
    for (const folder of this.changedMonths) {
      const invoices = await this.invoicesIn(folder);
      const file = join(folder, METADATA_FILE);

      if (invoices.size === 0) {
        await rm(file, { force: true });
      } else {
        const content: MetadataFile = { version: METADATA_VERSION, invoices: Object.fromEntries(invoices) };
        await writeJson(file, content);
      }
    }

    for (const pdf of this.pdfsToDelete) {
      await rm(pdf, { force: true });
    }
    this.pdfsToDelete = [];
    this.changedMonths.clear();

    let cachedInvoices = 0;
    for (const invoices of this.months.values()) {
      cachedInvoices += invoices.size;
    }

    if (cachedInvoices > MAX_CACHED_INVOICES) {
      Logger.info(`Clearing metadata cache (${cachedInvoices} invoices loaded, limit ${MAX_CACHED_INVOICES})`);
      this.months.clear();
    }
  }

  private async invoicesIn(folder: string): Promise<Map<number, Invoice>> {
    const cached = this.months.get(folder);
    if (cached) {
      return cached;
    }

    const file = join(folder, METADATA_FILE);
    const saved = (await readJson(file)) as Partial<MetadataFile> | undefined;

    if (saved && saved.version !== METADATA_VERSION) {
      throw new Error(
        `File ${chalk.gray(file)} has format version ${String(saved.version)}, expected ${METADATA_VERSION}`,
      );
    }

    const invoices = new Map<number, Invoice>();
    const savedInvoices = Object.values(saved?.invoices ?? {});
    for (const invoice of savedInvoices) {
      invoices.set(invoice.id, invoice);
    }
    this.months.set(folder, invoices);
    return invoices;
  }
}

export function omit(invoice: Invoice, fields: string[]): Invoice {
  const keptEntries: [string, unknown][] = [];
  for (const [key, value] of Object.entries(invoice)) {
    if (!fields.includes(key)) {
      keptEntries.push([key, value]);
    }
  }
  return Object.fromEntries(keptEntries) as Invoice;
}
