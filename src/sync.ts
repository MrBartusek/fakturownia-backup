import type { FakturowniaClient } from './fakturownia/client.ts';
import { Logger } from './logger.ts';

// Mock
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used once the download exists
export async function syncInvoices(client: FakturowniaClient, output: string) {
  Logger.info('Starting invoices download job...');
  await Promise.resolve();
}
