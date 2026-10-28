import { join } from 'node:path';
import chalk from 'chalk';
import { readJson, writeJson } from './files.ts';

const STATE_FILE = '.state.json';
const STATE_VERSION = 1;

type SyncState = {
  lastRunAt: number | null;

  complete: boolean;
  completedAt: number | null;

  failed: boolean;
  failedAt: number | null;
};

type StateFile = { version: number } & SyncState;

export async function loadState(output: string): Promise<SyncState> {
  const file = join(output, STATE_FILE);
  const saved = (await readJson(file)) as Partial<StateFile> | undefined;

  if (saved && saved.version !== STATE_VERSION) {
    throw new Error(`File ${chalk.gray(file)} has format version ${String(saved.version)}, expected ${STATE_VERSION}`);
  }

  return {
    complete: saved?.complete === true,
    completedAt: saved?.completedAt ?? null,
    failed: saved?.failed === true,
    failedAt: saved?.failedAt ?? null,
    lastRunAt: saved?.lastRunAt ?? null,
  };
}

export async function saveState(output: string, state: SyncState) {
  const content: StateFile = { version: STATE_VERSION, ...state };
  await writeJson(join(output, STATE_FILE), content);
}
