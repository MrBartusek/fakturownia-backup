import { inspect } from 'node:util';
import chalk from 'chalk';

export class Logger {
  static info(message: string) {
    console.log(`${Logger.time()} ${chalk.green('INFO')} ${message}`);
  }

  static warn(message: string) {
    console.error(`${Logger.time()} ${chalk.yellow('WARN')} ${message}`);
  }

  static error(message: string, error?: unknown) {
    const details = error === undefined ? '' : `\n${inspect(error)}`;
    console.error(`${Logger.time()} ${chalk.red('ERROR')} ${message}${details}`);
  }

  private static time() {
    return chalk.gray(new Date().toLocaleString('sv-SE'));
  }
}
