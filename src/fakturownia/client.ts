import { readFileSync } from 'node:fs';
import type { Config } from '../config.ts';
import type { Department, Invoice, InvoiceType } from './types.ts';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);
const PACKAGE_JSON = JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf8')) as { version: string };
const USER_AGENT = `fakturownia-backup/${PACKAGE_JSON.version} (+https://github.com/MrBartusek/fakturownia-backup)`;

export const INVOICES_PER_PAGE = 100;

export class FakturowniaClient {
  private readonly token: string;
  readonly baseUrl: string;

  constructor({ token, domain }: Config['fakturownia']) {
    this.token = token;
    this.baseUrl = `https://${domain}.fakturownia.pl`;
  }

  async listDepartments(): Promise<Department[]> {
    const departments = await this.request('/departments.json').then(
      (response) => response.json() as Promise<Department[]>,
    );
    return departments.filter((department) => !department.deleted);
  }

  async listInvoices(type: InvoiceType, page: number): Promise<Invoice[]> {
    return this.request('/invoices.json', {
      period: 'all',
      order: 'updated_at.desc',
      per_page: String(INVOICES_PER_PAGE),
      page: String(page),
      include_positions: 'true',
      income: type === 'income' ? 'yes' : 'no',
    }).then((response) => response.json() as Promise<Invoice[]>);
  }

  async downloadPdf(id: number): Promise<Uint8Array> {
    const response = await this.request(`/invoices/${id}.pdf`, {}, 'application/pdf');
    const body = await response.arrayBuffer();
    const pdf = new Uint8Array(body);

    const header = new TextDecoder().decode(pdf.subarray(0, 4));
    if (header !== '%PDF') {
      throw new Error(`/invoices/${id}.pdf is not a PDF`);
    }

    return pdf;
  }

  private async request(
    path: string,
    queryParameters: Record<string, string> = {},
    accept = 'application/json',
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    url.search = new URLSearchParams(queryParameters).toString();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: accept, 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
    }
    return response;
  }
}
