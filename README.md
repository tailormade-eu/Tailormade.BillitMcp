# Billit MCP Server

MCP server for the [Billit](https://billit.be) invoicing API.

## Tools

| Category | Tools |
|----------|-------|
| Orders | billit_list_orders, billit_get_order, billit_create_order, billit_update_order, billit_confirm_order, billit_delete_order, billit_register_payment, billit_send_order |
| Parties | billit_list_parties, billit_get_party, billit_create_party, billit_update_party |
| Products | billit_list_products, billit_get_product, billit_create_product |
| Peppol | billit_peppol_list_inbox, billit_peppol_confirm_inbox, billit_peppol_refuse_inbox, billit_peppol_send_order, billit_peppol_lookup_participant, billit_peppol_register, billit_peppol_unregister |
| Documents | billit_list_documents, billit_get_document, billit_upload_document, billit_download_file |
| Financial | billit_list_financial_transactions, billit_import_financial_transactions, billit_list_reports, billit_get_report, billit_get_account_info, billit_search_company, billit_list_typecodes, billit_list_accountant_feeds, billit_confirm_accountant_feed, billit_download_accountant_file |
| ToProcess | billit_submit_for_processing, billit_cancel_processing |

## Setup

```json
{
  "mcpServers": {
    "billit": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "BILLIT_API_KEY": "your-api-key",
        "BILLIT_PARTY_ID": "12345",
        "BILLIT_CONTEXT_PARTY_ID": "67890"
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| BILLIT_API_KEY | Yes | API key from Billit account |
| BILLIT_PARTY_ID | Yes | Your Billit party ID |
| BILLIT_CONTEXT_PARTY_ID | No | Context party ID (for accountants acting on behalf) |
