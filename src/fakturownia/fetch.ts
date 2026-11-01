import { setTimeout } from 'node:timers/promises';
import chalk from 'chalk';
import { Logger } from '../logger.ts';

const REQUEST_TIMEOUT_SECONDS = 60;
const MAX_ATTEMPTS = 15;

type AttemptResult = { ok: true; body: Buffer } | { ok: false; retryable: boolean; reason: string };

export async function fetchWithRetries(url: URL, headers: Record<string, string>): Promise<Buffer> {
  const path = url.pathname;

  for (let attemptNumber = 1; ; attemptNumber++) {
    const result = await attempt(url, headers);
    if (result.ok) {
      return result.body;
    }

    if (!result.retryable) {
      throw new Error(`${path} failed: ${result.reason}`);
    }

    if (attemptNumber === MAX_ATTEMPTS) {
      throw new Error(`${path} failed after ${attemptNumber} attempts: ${result.reason}`);
    }

    const delaySeconds = retryDelaySeconds(attemptNumber);
    const attemptNote = chalk.gray(`(attempt ${attemptNumber})`);
    Logger.warn(`Request ${chalk.gray(path)} failed (${result.reason}), retrying in ${delaySeconds}s ${attemptNote}`);

    await setTimeout(delaySeconds * 1000);
  }
}

/**
 * Fetches and reads the whole body, so a connection dropped mid-body is retried too.
 */
async function attempt(url: URL, headers: Record<string, string>): Promise<AttemptResult> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECONDS * 1000),
    });

    if (!response.ok) {
      // The body isn't needed, cancelling it frees the connection
      await response.body?.cancel();

      const retryable = response.status === 429 || response.status >= 500;
      return { ok: false, retryable, reason: `${response.status} ${response.statusText}` };
    }

    const body = Buffer.from(await response.arrayBuffer());
    return { ok: true, body };
  } catch (error) {
    return { ok: false, retryable: true, reason: networkErrorReason(error) };
  }
}

function retryDelaySeconds(attemptNumber: number): number {
  const DELAYS_SECONDS = [10, 60, 120];
  return DELAYS_SECONDS[attemptNumber - 1] ?? 600;
}

function networkErrorReason(error: unknown): string {
  if (error instanceof DOMException) {
    return `timed out after ${REQUEST_TIMEOUT_SECONDS}s`;
  }

  const networkError = error as TypeError & { cause?: { code?: string } };
  return networkError.cause?.code ?? networkError.message;
}
