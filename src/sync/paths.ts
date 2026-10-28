import { join } from 'node:path';
import type { Department, Invoice } from '../fakturownia/types.ts';

export const FALLBACK_FOLDER = '_';

/** Departments whose folder names clash get " (<id>)", so the whole list is needed at once. */
export function departmentFolders(departments: Department[]): Map<number | null, string> {
  const folders = new Map<number | null, string>();

  for (const department of departments) {
    const name = folderName(department);
    const clash = departments.some((other) => other.id !== department.id && folderName(other) === name);
    folders.set(department.id, clash ? `${name} (${department.id})` : name);
  }

  return folders;
}

export function invoicePath(output: string, folder: string, invoice: Invoice): string {
  const year = invoice.issue_date.slice(0, 4);
  const month = invoice.issue_date.slice(0, 7);
  return join(output, folder, year, month, `${clean(invoice.number)}_${invoice.kind}_${invoice.id}.pdf`);
}

function folderName({ id, shortcut, name }: Department) {
  return clean(shortcut) || clean(name) || String(id);
}

function clean(value: string) {
  return value
    .replaceAll(/[/\\:*?"<>|]/g, '-')
    .replace(/[\s.]+$/, '')
    .trim();
}
