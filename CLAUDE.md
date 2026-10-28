# fakturownia-backup

Self-hosted backup of [fakturownia.pl](https://fakturownia.pl) invoices, in the spirit of [gickup](https://gickup.dev). A Docker container runs a built-in cron that pulls invoices from the Fakturownia API into a local folder.

## Fakturownia API

The full reference (Polish, ~120 KB) is https://raw.githubusercontent.com/fakturownia/API/refs/heads/master/README.md. Fetch it when you need something not listed here.

The help center (Polish) at https://pomoc.fakturownia.pl explains app concepts the API docs assume, like departments (działy) vs. companies.

- Base URL is per account: `https://<domain>.fakturownia.pl`. Auth is an `Authorization: Bearer <token>` header (undocumented, the docs only show the `api_token` query parameter).
- The config takes a "Token z prefiksem" (Ustawienia -> API -> Zobacz), shaped `<token>/<domain>`. The domain for the base URL comes from that suffix. The official docs don't describe this format, and their menu path for the token is outdated.
- List invoices: `GET /invoices.json`. Paginate with `page=` and `per_page=` (max 100).
- Filter by date with `period=` (`all`, `last_12_months`, …) or `period=more&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`.
- The list returns sales invoices only by default. Expense invoices need `income=no`.
- Download PDF: `GET /invoices/<id>.pdf`.

## Compliance

The goal is a second copy of invoices in case Fakturownia loses data or the account ends. Polish law requires keeping invoices until the tax limitation period ends (5 years from the end of the year the tax was due, often longer), so the backup never deletes anything on its own.

- For KSeF invoices, the legal invoice is the FA(3) XML. The PDF is only a visualization.
- For cost invoices outside KSeF, the legal document is the original file the company received, not Fakturownia's rendered PDF.
- Both are invoice attachments: `GET /invoices/<id>/attachments_zip.json` returns them in one ZIP, the KSeF XML together with the UPO for sales invoices.

## Design limits

The target is a company with 100,000 invoices over 10 years, running in a container with 256 MB of memory. Check memory use against this when changing the sync. Companies much bigger than this are not the audience.

## Code style

- Use TypeScript `private` for class members, not JS `#private` fields.
- Don't save space on names; readability beats cleverness. Spell things out instead of abbreviating, and don't use single-letter iterator names.
- Comments are rare. Only write one to explain genuinely tricky code or the reason behind a questionable decision.
