import { Cron } from 'croner';
import { loadConfig, type Config } from './config.ts';
import { FakturowniaClient } from './fakturownia/client.ts';
import { Logger } from './logger.ts';
import { syncInvoices } from './sync.ts';

async function main() {
  let config: Config;
  let client: FakturowniaClient;

  try {
    config = await loadConfig(process.argv[2] ?? 'conf.yml');
    client = new FakturowniaClient(config.fakturownia);

    const company = await client.getCompany();
    Logger.info(`Logged in as ${company.name} (NIP ${company.taxNo})`);
  } catch (error) {
    Logger.error('Startup failed', error);
    process.exit(1);
  }

  if (!config.cron) {
    Logger.info('No cron schedule set, downloading once!');
    await run(client, config.output);
  } else {
    const job = new Cron(config.cron, { protect: true }, () => run(client, config.output));

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        Logger.info(`Received ${signal}, shutting down...`);
        job.stop();
      });
    }

    Logger.info(`Next run: ${job.nextRun()?.toLocaleString('sv-SE')}`);
  }
}

async function run(client: FakturowniaClient, output: string) {
  try {
    await syncInvoices(client, output);
  } catch (error) {
    Logger.error('Invoices download job failed', error);
    process.exitCode = 1;
  }
}

await main();
