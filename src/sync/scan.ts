import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { Logger } from '../logger.ts';
import { isTempFile } from './files.ts';
import { invoiceIdFromFile } from './paths.ts';

/**
 * Finds every invoice PDF in `output` by the id at the end of its file name. One id has two PDFs only when a run
 * was killed in the middle of a move. Also creates `output` if it's missing and deletes temp files left behind.
 */
export async function scanInvoices(output: string): Promise<Map<number, string[]>> {
  await mkdir(output, { recursive: true });
  const entries = await readdir(output, { recursive: true, withFileTypes: true });
  const pdfPaths = new Map<number, string[]>();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const file = join(entry.parentPath, entry.name);

    if (isTempFile(file)) {
      Logger.warn(`File ${chalk.gray(file)} is left over from an interrupted run and will be deleted`);
      await rm(file, { force: true });
      continue;
    }

    const id = invoiceIdFromFile(file);
    if (id !== undefined) {
      const copies = pdfPaths.get(id) ?? [];
      copies.push(file);
      pdfPaths.set(id, copies);
    }
  }

  return pdfPaths;
}
