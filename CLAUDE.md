# Billit MCP — Architecture & Development Guide

## Architecture

### Tool registration
- Each category has its own file: `src/tools/{category}.ts`
- Each file exports `register{Category}Tools(server, client)`
- All are called in `src/index.ts` `main()`

### Auth
- `BillitClient` in `src/api/client.ts`
- Headers: `ApiKey`, `PartyID`, optional `ContextPartyID`
- Env vars: `BILLIT_API_KEY`, `BILLIT_PARTY_ID`, `BILLIT_CONTEXT_PARTY_ID`

### Pagination
- OData: `$top` and `$skip` query params
- `fullTextSearch` is always a separate query param (never in `$filter`)

## Adding or improving a tool

1. Find the tool in `src/tools/{category}.ts`
2. Update the description string (second arg to `server.tool()`)
3. Add/update `llmTip` in the description for API quirks
4. Ensure every param has `.describe()` with format + constraints
5. Run `npm run build` + `npm run check-coverage`

## Known API quirks

| Quirk | Details |
|-------|---------|
| OrderDirection naming | `Income` = outgoing (sales) invoices, `Cost` = incoming (purchase) invoices |
| fullTextSearch | Must be separate query param, never in OData `$filter` |
| OData date format | `LastModified ge datetime'2026-01-01T00:00:00'` |
| Files vs Documents | `DocumentID` is numeric, `fileID` is UUID — different endpoints |
| Peppol prerequisite | Customer must be Peppol participant before `billit_peppol_send_order` |
| Accountant feed polling | Max once per minute — always confirm items after download |
| billit_create_product | Acts as upsert if same `reference` exists |

## Development

### Build
```bash
npm run build
```

### Coverage check
```bash
npm run check-coverage
```

### Run in dev mode
```bash
BILLIT_API_KEY=xxx BILLIT_PARTY_ID=123 npm run dev
```

### Claude Desktop config
```json
{
  "mcpServers": {
    "billit": {
      "command": "node",
      "args": ["C:/path/to/dist/index.js"],
      "env": {
        "BILLIT_API_KEY": "your-api-key",
        "BILLIT_PARTY_ID": "12345"
      }
    }
  }
}
```

## Tool categories

| File | Tools | Count |
|------|-------|-------|
| orders.ts | billit_list_orders, billit_get_order, billit_create_order, billit_update_order, billit_confirm_order, billit_delete_order, billit_register_payment, billit_send_order | 8 |
| parties.ts | billit_list_parties, billit_get_party, billit_create_party, billit_update_party | 4 |
| products.ts | billit_list_products, billit_get_product, billit_create_product | 3 |
| peppol.ts | billit_peppol_list_inbox, billit_peppol_confirm_inbox, billit_peppol_refuse_inbox, billit_peppol_send_order, billit_peppol_lookup_participant, billit_peppol_register, billit_peppol_unregister | 7 |
| documents.ts | billit_list_documents, billit_get_document, billit_upload_document, billit_download_file | 4 |
| financial.ts | billit_list_financial_transactions, billit_import_financial_transactions, billit_list_reports, billit_get_report, billit_get_account_info, billit_search_company, billit_list_typecodes, billit_list_accountant_feeds, billit_register_accountant_feed, billit_confirm_accountant_feed, billit_download_accountant_file | 11 |
| toprocess.ts | billit_submit_for_processing, billit_cancel_processing | 2 |

**Total: 39 tools**
