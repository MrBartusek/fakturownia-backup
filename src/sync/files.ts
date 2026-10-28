import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { Logger } from '../logger.ts';

const TEMP_FILE_SUFFIX = '.tmp';
const TEMP_FILE_PATTERN = /\.(pdf|json)\.tmp$/;

export async function readJson(file: string): Promise<unknown> {
  try {
    const text = await readFile(file, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    // A corrupt file would otherwise fail every run; ignoring it makes the sync rebuild it
    if (error instanceof SyntaxError) {
      Logger.warn(`File ${chalk.gray(file)} is corrupted and will be ignored: ${error.message}`);
      return undefined;
    }
    throw error;
  }
}

export async function writeJson(file: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  await writeAtomic(file, text);
}

/**
 * Writes to a `.tmp` file first and renames it, so a crash never leaves a half-written file under the real name.
 */
export async function writeAtomic(file: string, data: string | Uint8Array) {
  const tempFile = file + TEMP_FILE_SUFFIX;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(tempFile, data);
  await rename(tempFile, file);
}

export function isTempFile(file: string): boolean {
  return TEMP_FILE_PATTERN.test(file);
}
