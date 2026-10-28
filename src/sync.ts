import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import chalk from 'chalk';
import { INVOICES_PER_PAGE, type FakturowniaClient } from './fakturownia/client.ts';
import type { InvoiceType } from './fakturownia/types.ts';
import { Logger } from './logger.ts';

const invoiceTypes: InvoiceType[] = ['income', 'expense'];
const downloadDelayMs = 100;

export async function syncInvoices(client: FakturowniaClient, output: string) {
  Logger.info('Starting invoices download job...');
  await mkdir(output, { recursive: true });

  let downloaded = 0;
  for (const type of invoiceTypes) {
    for (let page = 1; ; page++) {
      const invoices = await client.listInvoices(type, page);

      for (const invoice of invoices) {
        const file = join(output, `${invoice.number.replaceAll('/', '-')}_${invoice.id}.pdf`);
        await writeFile(file, await client.downloadPdf(invoice.id));
        Logger.info(`Downloaded ${type} invoice ${invoice.number} to ${chalk.gray(file)}`);
        downloaded++;
        await setTimeout(downloadDelayMs);
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
