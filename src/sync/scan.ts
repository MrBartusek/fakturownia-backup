import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { Logger } from '../logger.ts';
import { isTempFile } from './files.ts';
import { invoiceIdFromFile } from './paths.ts';

const DEPARTMENT_FOLDER_PATTERN = /^[^.]/;
const YEAR_FOLDER_PATTERN = /^\d{4}$/;
const MONTH_FOLDER_PATTERN = /^\d{4}-\d{2}$/;

/**
 * Finds every invoice PDF by the id at the end of its file name, only in `<output>/<department>/<YYYY>/<YYYY-MM>`,
 * since `output` can hold other files too. One id has two PDFs only when a run was killed in the middle of a move.
 * Also creates `output` if it's missing and deletes temp files left behind.
 */
export async function scanInvoices(output: string): Promise<Map<number, string[]>> {
  await mkdir(output, { recursive: true });
  await removeTempFiles(output);

  const pdfPaths = new Map<number, string[]>();

  for (const department of await subfolders(output, DEPARTMENT_FOLDER_PATTERN)) {
    for (const year of await subfolders(department, YEAR_FOLDER_PATTERN)) {
      for (const month of await subfolders(year, MONTH_FOLDER_PATTERN)) {
        for (const file of await removeTempFiles(month)) {
          const id = invoiceIdFromFile(file);
          if (id !== undefined) {
            const copies = pdfPaths.get(id) ?? [];
            copies.push(file);
            pdfPaths.set(id, copies);
          }
        }
      }
    }
  }

  return pdfPaths;
}

async function subfolders(folder: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const folders: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && pattern.test(entry.name)) {
      folders.push(join(folder, entry.name));
    }
  }

  return folders;
}

/**
 * Returns the other files in `folder`.
 */
async function removeTempFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const file = join(folder, entry.name);

    if (isTempFile(file)) {
      Logger.warn(`File ${chalk.gray(file)} is left over from an interrupted run and will be deleted`);
      await rm(file, { force: true });
    } else {
      files.push(file);
    }
  }

  return files;
}
