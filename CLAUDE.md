# fakturownia-backup

Self-hosted backup of [fakturownia.pl](https://fakturownia.pl) invoices, in the spirit of [gickup](https://gickup.dev). A Docker container runs a built-in cron that pulls invoices from the Fakturownia API into a local folder.

## Fakturownia API

The full reference (Polish, ~120 KB) is https://raw.githubusercontent.com/fakturownia/API/refs/heads/master/README.md. Fetch it when you need something not listed here.

- Base URL is per account: `https://<domain>.fakturownia.pl`. Auth is the `api_token` query parameter.
- The config takes a "Token z prefiksem" (Ustawienia -> API -> Zobacz), shaped `<token>/<domain>`. The domain for the base URL comes from that suffix. The official docs don't describe this format, and their menu path for the token is outdated.
- List invoices: `GET /invoices.json`. Paginate with `page=` and `per_page=` (max 100).
- Filter by date with `period=` (`all`, `last_12_months`, …) or `period=more&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`.
- The list returns sales invoices only by default. Expense invoices need `income=no`.
- Download PDF: `GET /invoices/<id>.pdf`.
