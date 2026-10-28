import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Cron } from 'croner';
import { parse } from 'yaml';
import * as z from 'zod';
import { Logger } from './logger.ts';
import chalk from 'chalk';

const CONFIG_SCHEMA = z.object({
  fakturownia: z
    .object({
      token: z.string().regex(/^[^/\s]+\/[a-z0-9-]+$/i, 'Expected <token>/<domain>'),
    })
    .transform(({ token }) => {
      const [apiToken = '', domain = ''] = token.split('/');
      return { token: apiToken, domain };
    }),
  output: z
    .string()
    .default('/fakturownia')
    .transform((path) => resolve(path)),
  cron: z.string().refine(isValidCron, 'Invalid cron expression').nullish(),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

export async function loadConfig(filePath: string): Promise<Config> {
  const absolutePath = resolve(filePath);
  Logger.info(`Reading config in ${chalk.gray(absolutePath)}`);

  let data: unknown;
  try {
    const contents = await readFile(absolutePath, 'utf8');
    data = parse(contents);
  } catch (error) {
    throw new Error(`Cannot load config ${absolutePath}`, { cause: error });
  }

  const result = CONFIG_SCHEMA.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid config ${absolutePath}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function isValidCron(expression: string) {
  try {
    new Cron(expression);
    return true;
  } catch {
    return false;
  }
}
