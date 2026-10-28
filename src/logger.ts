import { inspect } from 'node:util';
import chalk from 'chalk';

export class Logger {
  static info(message: string) {
    console.log(`${Logger.timestamp()} ${chalk.green('INFO')} ${message}`);
  }

  static warn(message: string) {
    console.error(`${Logger.timestamp()} ${chalk.yellow('WARN')} ${message}`);
  }

  static error(message: string, error?: unknown) {
    const details = error === undefined ? '' : `\n${inspect(error)}`;
    console.error(`${Logger.timestamp()} ${chalk.red('ERROR')} ${message}${details}`);
  }

  private static timestamp() {
    return chalk.gray(new Date().toLocaleString('sv-SE'));
  }
}
