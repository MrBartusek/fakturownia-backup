import { basename, join } from 'node:path';
import type { Department, Invoice } from '../fakturownia/types.ts';

export const FALLBACK_FOLDER = '_';
const NO_NUMBER_NAME = 'bez-numeru';

/**
 * Caps the invoice number, so the whole file name stays well under the 255-byte limit of most file systems.
 */
const MAX_NUMBER_BYTES = 100;

/**
 * Departments whose folder names clash get " (<id>)", so the whole list is needed at once.
 */
export function departmentFolders(departments: Department[]): Map<number | null, string> {
  const folders = new Map<number | null, string>();

  for (const department of departments) {
    const name = folderName(department);
    const clash = departments.some((other) => other.id !== department.id && folderName(other) === name);
    const folder = clash ? `${name} (${department.id})` : name;
    folders.set(department.id, folder);
  }

  return folders;
}

export function invoicePath(output: string, folder: string, invoice: Invoice): string {
  const { year, month } = splitDate(invoice.issue_date);
  const fileName = invoiceFileName(invoice);
  return join(output, folder, year, `${year}-${month}`, fileName);
}

export function invoiceFileName(invoice: Invoice): string {
  const invoiceNumber = sanitizeFileName(truncateToBytes(invoice.number, MAX_NUMBER_BYTES)) || NO_NUMBER_NAME;
  return `${invoiceNumber}_${invoice.kind}_${invoice.id}.pdf`;
}

/**
 * Reads the id from a `<number>_<kind>_<id>.pdf` file name, or returns undefined for any other file.
 */
export function invoiceIdFromFile(file: string): number | undefined {
  const INVOICE_FILE_PATTERN = /^.+_[a-z_]+_(?<id>\d+)\.pdf$/;

  const fileName = basename(file);
  const id = INVOICE_FILE_PATTERN.exec(fileName)?.groups?.id;

  if (!id) {
    return undefined;
  }

  return Number(id);
}

function splitDate(date: string) {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

function folderName({ id, shortcut, name }: Department) {
  return sanitizeFileName(shortcut) || sanitizeFileName(name) || String(id);
}

function truncateToBytes(value: string, maxBytes: number) {
  const characters = Array.from(value);
  while (Buffer.byteLength(characters.join('')) > maxBytes) {
    characters.pop();
  }
  return characters.join('');
}

function sanitizeFileName(value: string) {
  return value
    .replaceAll(/[/\\:*?"<>|]/g, '-')
    .replace(/[\s.]+$/, '')
    .trim();
}
