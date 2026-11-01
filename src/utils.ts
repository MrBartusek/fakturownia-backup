export function isPdf(file: Buffer): boolean {
  const header = file.subarray(0, 4).toString();
  return header === '%PDF';
}

export function isZip(file: Buffer): boolean {
  const header = file.subarray(0, 4).toString();
  return header === 'PK\x03\x04';
}

export function omit<T extends object>(value: T, fields: string[]): T {
  const keptEntries: [string, unknown][] = [];
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!fields.includes(key)) {
      keptEntries.push([key, fieldValue]);
    }
  }
  return Object.fromEntries(keptEntries) as T;
}

export function splitDate(date: string): { year: string; month: string; day: string } {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

export function truncateToBytes(value: string, maxBytes: number): string {
  const characters = Array.from(value);
  while (Buffer.byteLength(characters.join('')) > maxBytes) {
    characters.pop();
  }
  return characters.join('');
}

export function sanitizeFileName(value: string): string {
  return value
    .replaceAll(/[/\\:*?"<>|]/g, '-')
    .replace(/[\s.]+$/, '')
    .trim();
}
