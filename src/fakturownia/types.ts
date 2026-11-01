export type Attachment = Record<string, unknown>;

export type Invoice = {
  id: number;
  number: string | null;
  kind: string;
  issue_date: string;
  updated_at: string;
  department_id: number | null;
  attachments: Attachment[];
  [key: string]: unknown;
};

export type Department = {
  id: number;
  shortcut: string;
  name: string;
  tax_no: string | null;
  deleted: boolean;
};

export type InvoiceType = 'income' | 'expense';
