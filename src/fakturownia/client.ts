import { readFileSync } from 'node:fs';
import type { Config } from '../config.ts';
import type { Department, Invoice, InvoiceType } from './types.ts';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const userAgent = `fakturownia-backup/${version} (+https://github.com/MrBartusek/fakturownia-backup)`;

export const INVOICES_PER_PAGE = 100;

export class FakturowniaClient {
  private readonly token: string;
  readonly baseUrl: string;

  constructor({ token, domain }: Config['fakturownia']) {
    this.token = token;
    this.baseUrl = `https://${domain}.fakturownia.pl`;
  }

  async listDepartments(): Promise<Department[]> {
    const departments = await this.request('/departments.json').then((r) => r.json() as Promise<Department[]>);
    return departments.filter((d) => !d.deleted);
  }

  async listInvoices(type: InvoiceType, page: number): Promise<Invoice[]> {
    return this.request('/invoices.json', {
      period: 'all',
      order: 'updated_at.desc',
      per_page: String(INVOICES_PER_PAGE),
      page: String(page),
      include_positions: 'true',
      income: type === 'income' ? 'yes' : 'no',
    }).then((r) => r.json() as Promise<Invoice[]>);
  }

  async downloadPdf(id: number): Promise<Uint8Array> {
    const response = await this.request(`/invoices/${id}.pdf`, {}, 'application/pdf');
    const pdf = new Uint8Array(await response.arrayBuffer());

    if (new TextDecoder().decode(pdf.subarray(0, 4)) !== '%PDF') {
      throw new Error(`/invoices/${id}.pdf is not a PDF`);
    }

    return pdf;
  }

  private async request(
    path: string,
    params: Record<string, string> = {},
    accept = 'application/json',
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    url.search = new URLSearchParams(params).toString();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: accept, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
    }
    return response;
  }
}
