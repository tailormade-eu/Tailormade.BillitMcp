# Billit MCP — Testing

## Acceptance Tests

| # | Test | Command/Action | Expected | Status |
|---|------|----------------|----------|--------|
| 1 | Build | `npm run build` | 0 errors | ⬜ |
| 2 | Coverage check | `npm run check-coverage` | 0 gaps | ⬜ |
| 3 | billit_get_account_info | Call without PartyID | Returns linked companies | ⬜ |
| 4 | billit_list_orders Income | `direction=Income` | Returns sales invoices | ⬜ |
| 5 | billit_list_orders Cost | `direction=Cost` | Returns purchase invoices | ⬜ |
| 6 | billit_get_order | Get by OrderID | Returns full order with PartyName | ⬜ |
| 7 | billit_list_parties | List with fullTextSearch | Returns matching parties | ⬜ |
| 8 | billit_list_products | List products | Returns product list | ⬜ |
| 9 | billit_create_product upsert | Create with existing reference | Updates instead of error | ⬜ |
| 10 | billit_list_documents | List documents | Returns document list | ⬜ |
| 11 | billit_download_file | Download by fileID (UUID) | Returns base64 content | ⬜ |
| 12 | billit_peppol_lookup_participant | Lookup by VAT | Returns Peppol registration status | ⬜ |
| 13 | billit_list_financial_transactions | List transactions | Returns transaction list | ⬜ |
| 14 | billit_search_company | Search by name/VAT | Returns company matches | ⬜ |
| 15 | billit_list_typecodes | List type codes | Returns available type codes | ⬜ |
| 16 | OData filtering | `$filter` with datetime format | Correct results | ⬜ |
| 17 | fullTextSearch | Separate from $filter | Returns search results | ⬜ |
| 18 | Multi-company | Switch company_id param | Correct company context | ⬜ |
| 19 | Zod string coercion | Pass number as string | Coerced correctly | ⬜ |
| 20 | create_order invalid lines JSON | Pass malformed JSON in `lines` param | Returns descriptive error with example, no crash | ⬜ |
| 21 | delete_order dry_run | `dry_run=true` on billit_delete_order | Returns confirmation message, no API call | ⬜ |

**Score: 0/21**

---

**Legend:** ✅ pass | ❌ fail | ⬜ not tested | 🔄 flaky
