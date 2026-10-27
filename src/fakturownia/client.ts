import type { Config } from '../config.ts';

export type Company = {
  name: string;
  taxNo: string;
};

export class FakturowniaClient {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor({ token, domain }: Config['fakturownia']) {
    this.token = token;
    this.baseUrl = `https://${domain}.fakturownia.pl`;
  }

  // Mock until the departments request exists.
  getCompany(): Promise<Company> {
    return Promise.resolve({ name: 'Example Company', taxNo: '0000000000' });
  }
}
