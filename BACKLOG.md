# Billit MCP — Backlog

## Planned

| # | Feature | Description | Impact |
|---|---------|-------------|--------|
| 01 | OAuth support | Billit supports OAuth2 in addition to API key auth. Add `BILLIT_CLIENT_ID` / `BILLIT_CLIENT_SECRET` / `BILLIT_REFRESH_TOKEN` flow with auto-token rotation (similar to TL MCP). Enables multi-user and marketplace scenarios. | High |
| 02 | npm publish | Publish `@tailormade/billit-mcp` to npm registry so `npx` install works without build-from-source | High |
| 03 | Subscriptions | Add tools for Billit subscription management (recurring invoices) | Medium |
| 04 | Credit notes workflow | Dedicated flow for creating and sending credit notes linked to original invoice | Medium |
| 05 | Quotations/Offers | Full offer workflow: create → send → convert to invoice | Medium |
| 06 | GLAccount support | Tools for `/v1/glaccounts` — create + import GL account codes for bookkeeping mapping | Low |
| 07 | Webhook support | Register/list/delete/refresh Billit webhooks. Events: Order (I/U/D) + Message. Signature verification for security. Requires HTTPS endpoint. | Low |
| 08 | Batch operations | Confirm and send multiple orders in one call | Low |
| 09 | Idempotent tokens | Add `IdempotentToken` header support on create operations (POST) to prevent duplicate invoice creation on retry | Low |
| 10 | Sandbox environment | Add `BILLIT_SANDBOX=true` env var to switch base URL to sandbox for safe testing | Low |
| 11 | sFTP / batch export | Document sFTP integration option for high-volume accountant export scenarios | Low |
| 12 | Regional extensions | Poland (KSeF), France (Chorus Pro) — extra fields on orders for cross-border compliance | Low |

## OAuth Implementation Notes

Billit supports OAuth2 (Authorization Code flow):
- Auth URL: `https://app.billit.be/oauth/authorize`
- Token URL: `https://app.billit.be/oauth/token`
- Scopes: TBD (check Billit API docs)
- Token rotation: same pattern as Teamleader MCP (`~/.billit-tokens.json`)

When implemented:
- `BILLIT_API_KEY` auth remains supported (backwards compatible)
- `BILLIT_CLIENT_ID` + `BILLIT_CLIENT_SECRET` + `BILLIT_REFRESH_TOKEN` = OAuth mode
- OAuth enables acting on behalf of multiple users (accountant use case)

## Known Limitations

| Limitation | Details |
|-----------|---------|
| No file streaming | `billit_download_file` returns base64 — large files may hit token limits |
| Async processing | `billit_submit_for_processing` is async — no webhook to know when done |
| Feed rate limit | `billit_list_accountant_feeds` max once per minute |
| Financial transaction `Info` field | Visible in Billit UI but not returned by the API |
| Financial transaction `Paid` checkbox | UI-only flag — not exposed via API, cannot be read or set |
| No update endpoint for transactions | No PATCH/PUT on `/v1/financialTransactions/{id}` — read-only via API |
| Incomplete bank history | Pre-PSD2 data only available if manually imported via CodaBox; gap between import periods is not visible |
| `fullTextSearch` limited scope | Does not search all fields (e.g. `Description` text in old CodaBox transactions) |
