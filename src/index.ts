import { parseArgs } from 'node:util';
import chalk from 'chalk';
import { Cron } from 'croner';
import { loadConfig, type Config } from './config.ts';
import { FakturowniaClient } from './fakturownia/client.ts';
import type { Department } from './fakturownia/types.ts';
import { Logger } from './logger.ts';
import { loadState } from './sync/state.ts';
import { syncInvoices, type SyncOptions } from './sync/sync.ts';

async function main() {
  let config: Config;
  let client: FakturowniaClient;
  let options: SyncOptions;
  let downloadComplete: boolean;

  try {
    const { values, positionals } = parseArgs({
      options: { full: { type: 'boolean', default: false } },
      allowPositionals: true,
    });
    const configPath = positionals[0] ?? 'conf.yml';
    options = values;

    config = await loadConfig(configPath);
    client = new FakturowniaClient(config.fakturownia);

    const departments = await client.listDepartments();
    logStartup(client, departments);

    const state = await loadState(config.output);
    downloadComplete = state.complete;
  } catch (error) {
    Logger.error('Startup failed', error);
    process.exit(1);
  }

  if (options.full) {
    Logger.warn(`Running with ${chalk.blue.bold('--full')}`);
    await runOnce(client, config.output, options);
  } else if (!config.cron) {
    Logger.info('No cron schedule set, downloading once!');
    await runOnce(client, config.output, options);
  } else {
    const job = new Cron(config.cron, { protect: true }, async (runningJob) => {
      await run(client, config.output, options);
      logNextRun(runningJob);
    });

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        Logger.info(`Received ${signal}, shutting down...`);
        process.exit(0);
      });
    }

    if (downloadComplete) {
      logNextRun(job);
    } else {
      Logger.warn('Output directory seems to be not initialized yet, triggering full run!');
      await job.trigger();
    }
  }
}

function logStartup(client: FakturowniaClient, departments: Department[]) {
  const host = chalk.blue.bold(new URL(client.baseUrl).host);
  const plural = departments.length === 1 ? '' : 's';
  const colon = departments.length > 0 ? ':' : '';
  Logger.info(`Logged in as ${host} with ${departments.length} department${plural}${colon}`);

  for (const department of departments) {
    const name = chalk.yellow(department.name.trim());
    const taxNumber = department.tax_no ? chalk.gray(` (NIP ${department.tax_no})`) : '';
    Logger.info(`- ${name}${taxNumber}`);
  }
}

function logNextRun(job: Cron) {
  const nextRunDate = job.nextRun();
  if (nextRunDate) {
    Logger.info(`Next run: ${nextRunDate.toLocaleString('sv-SE')} (${job.getPattern()})`);
  }
}

async function runOnce(client: FakturowniaClient, output: string, options: SyncOptions) {
  const success = await run(client, output, options);
  if (!success) {
    process.exitCode = 1;
  }
}

async function run(client: FakturowniaClient, output: string, options: SyncOptions): Promise<boolean> {
  try {
    await syncInvoices(client, output, options);
    return true;
  } catch (error) {
    Logger.error('Invoices download job failed', error);
    return false;
  }
}

await main();
