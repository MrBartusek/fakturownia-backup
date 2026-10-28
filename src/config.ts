import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Cron } from 'croner';
import { parse } from 'yaml';
import * as z from 'zod';
import { Logger } from './logger.ts';
import chalk from 'chalk';

const configSchema = z.object({
  fakturownia: z
    .object({
      token: z.string().regex(/^[^/\s]+\/[a-z0-9-]+$/i, 'Expected <token>/<domain>'),
    })
    .transform(({ token }) => {
      const [apiToken = '', domain = ''] = token.split('/');
      return { token: apiToken, domain };
    }),
  output: z.string().default('/fakturownia'),
  cron: z.string().refine(isValidCron, 'Invalid cron expression').nullish(),
});

export type Config = z.infer<typeof configSchema>;

export async function loadConfig(file: string): Promise<Config> {
  const path = resolve(file);
  Logger.info(`Reading config in ${chalk.gray(path)}`);

  let data: unknown;
  try {
    data = parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot load config ${path}`, { cause: error });
  }

  const result = configSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid config ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function isValidCron(value: string) {
  try {
    new Cron(value);
    return true;
  } catch {
    return false;
  }
}
