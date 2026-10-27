import { inspect, styleText } from 'node:util';

const levels = {
  info: { color: 'green', stream: process.stdout },
  warn: { color: 'yellow', stream: process.stderr },
  error: { color: 'red', stream: process.stderr },
} as const;

type Level = keyof typeof levels;

export class Logger {
  static info(message: string) {
    Logger.write('info', message);
  }

  static warn(message: string) {
    Logger.write('warn', message);
  }

  static error(message: string, error?: unknown) {
    Logger.write('error', error === undefined ? message : `${message}\n${inspect(error)}`);
  }

  private static write(level: Level, message: string) {
    const { color, stream } = levels[level];
    const time = styleText('gray', new Date().toLocaleString('sv-SE'), { stream });
    const label = styleText(color, level.toUpperCase(), { stream });
    stream.write(`${time} ${label} ${message}\n`);
  }
}
