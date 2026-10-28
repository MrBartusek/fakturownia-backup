import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import chalk from 'chalk';
import { INVOICES_PER_PAGE, type FakturowniaClient } from '../fakturownia/client.ts';
import type { InvoiceType } from '../fakturownia/types.ts';
import { Logger } from '../logger.ts';
import { departmentFolders, FALLBACK_FOLDER, invoicePath } from './paths.ts';

const INVOICE_TYPES: InvoiceType[] = ['income', 'expense'];
const DOWNLOAD_DELAY_MS = 100;

export async function syncInvoices(client: FakturowniaClient, output: string) {
  Logger.info('Starting invoices sync job...');

  const departments = await client.listDepartments();
  const folders = departmentFolders(departments);

  let downloaded = 0;
  for (const type of INVOICE_TYPES) {
    for (let page = 1; ; page++) {
      const invoices = await client.listInvoices(type, page);

      for (const invoice of invoices) {
        const folder = folders.get(invoice.department_id) ?? FALLBACK_FOLDER;
        const file = invoicePath(output, folder, invoice);

        const pdf = await client.downloadPdf(invoice.id);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, pdf);

        Logger.info(
          `Downloaded ${chalk.bold(invoice.number)} ${chalk.yellow(`(${type})`)} to ${chalk.gray(relative(output, file))}`,
        );
        downloaded++;
        await setTimeout(DOWNLOAD_DELAY_MS);
      }

      if (invoices.length < INVOICES_PER_PAGE) {
        break;
      }
    }
  }

  if (downloaded === 0) {
    Logger.warn('No invoices found in this Fakturownia account, nothing to download');
  }
}
