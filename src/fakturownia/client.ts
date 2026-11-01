import { readFileSync } from 'node:fs';
import type { Config } from '../config.ts';
import { isPdf, isZip, omit } from '../utils.ts';
import { fetchWithRetries } from './fetch.ts';
import type { Department, Invoice, InvoiceType } from './types.ts';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);
const PACKAGE_JSON = JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf8')) as { version: string };
const USER_AGENT = `fakturownia-backup/${PACKAGE_JSON.version} (+https://github.com/MrBartusek/fakturownia-backup)`;

export const INVOICES_PER_PAGE = 100;

/**
 * Public links to the attachment, never written to the backup.
 */
const ATTACHMENT_LINK_FIELDS = ['token', 'attachment_url'];

export class FakturowniaClient {
  private readonly token: string;
  readonly baseUrl: string;

  constructor({ token, domain }: Config['fakturownia']) {
    this.token = token;
    this.baseUrl = `https://${domain}.fakturownia.pl`;
  }

  async listDepartments(): Promise<Department[]> {
    const body = await this.request('/departments.json');
    const departments = JSON.parse(body.toString()) as Department[];
    return departments.filter((department) => !department.deleted);
  }

  async listInvoices(type: InvoiceType, page: number): Promise<Invoice[]> {
    const body = await this.request('/invoices.json', {
      period: 'all',
      order: 'updated_at.desc',
      per_page: String(INVOICES_PER_PAGE),
      page: String(page),
      include_positions: 'true',
      income: type === 'income' ? 'yes' : 'no',
      'additional_fields[invoice]': [
        'corrected_content_before',
        'corrected_content_after',
        'correction_reason',
        'procedure_vat_margin',
        'seller_bdo_no',
      ].join(','),
      include: [
        'descriptions',
        'recipients',
        'issuers',
        'transaction_orders',
        'transaction_contracts',
        'transaction_batches',
        'attachments',
      ].join(','),
    });
    const invoices = JSON.parse(body.toString()) as Invoice[];

    for (const invoice of invoices) {
      invoice.attachments = invoice.attachments.map((attachment) => omit(attachment, ATTACHMENT_LINK_FIELDS));
    }

    return invoices;
  }

  async downloadPdf(id: number): Promise<Buffer> {
    const pdf = await this.request(`/invoices/${id}.pdf`, {}, 'application/pdf');

    if (!isPdf(pdf)) {
      throw new Error(`/invoices/${id}.pdf is not a PDF`);
    }

    return pdf;
  }

  async downloadAttachments(id: number): Promise<Buffer> {
    const zip = await this.request(`/invoices/${id}/attachments_zip.json`, {}, 'application/zip');

    if (!isZip(zip)) {
      throw new Error(`/invoices/${id}/attachments_zip.json is not a ZIP with files in it`);
    }

    return zip;
  }

  private async request(
    path: string,
    queryParameters: Record<string, string> = {},
    accept = 'application/json',
  ): Promise<Buffer> {
    const url = new URL(path, this.baseUrl);
    url.search = new URLSearchParams(queryParameters).toString();

    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: accept,
      'User-Agent': USER_AGENT,
    };

    return fetchWithRetries(url, headers);
  }
}
