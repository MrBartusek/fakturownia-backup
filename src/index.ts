import chalk from 'chalk';
import { Cron } from 'croner';
import { loadConfig, type Config } from './config.ts';
import { FakturowniaClient } from './fakturownia/client.ts';
import type { Department } from './fakturownia/types.ts';
import { Logger } from './logger.ts';
import { syncInvoices } from './sync/sync.ts';

async function main() {
  let config: Config;
  let client: FakturowniaClient;

  try {
    config = await loadConfig(process.argv[2] ?? 'conf.yml');
    client = new FakturowniaClient(config.fakturownia);

    const departments = await client.listDepartments();
    logStartup(client, departments);
  } catch (error) {
    Logger.error('Startup failed', error);
    process.exit(1);
  }

  if (!config.cron) {
    Logger.info('No cron schedule set, downloading once!');
    await run(client, config.output);
  } else {
    const job = new Cron(config.cron, { protect: true }, async (self) => {
      await run(client, config.output);
      logNextRun(self);
    });

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        Logger.info(`Received ${signal}, shutting down...`);
        job.stop();
      });
    }

    logNextRun(job);
  }
}

function logStartup(client: FakturowniaClient, departments: Department[]) {
  const host = chalk.blue.bold(new URL(client.baseUrl).host);
  const plural = departments.length === 1 ? '' : 's';
  const colon = departments.length > 0 ? ':' : '';
  Logger.info(`Logged in as ${host} with ${departments.length} department${plural}${colon}`);

  for (const department of departments) {
    const name = chalk.yellow(department.name.trim());
    const nip = department.tax_no ? chalk.gray(` (NIP ${department.tax_no})`) : '';
    Logger.info(`- ${name}${nip}`);
  }
}

function logNextRun(job: Cron) {
  const next = job.nextRun();
  if (next) {
    Logger.info(`Next run: ${next.toLocaleString('sv-SE')} (${job.getPattern()})`);
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
