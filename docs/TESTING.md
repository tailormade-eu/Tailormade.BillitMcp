# BillitMcp — Testing Guide

## Setup

```bash
npm run build
```

Configure `~/.claude.json`:
```json
"billit": {
  "command": "node",
  "args": ["D:\\source\\repos\\Tailormade\\Tailormade.BillitMcp\\dist\\index.js"],
  "env": {
    "BILLIT_API_KEY": "<your-api-key>"
  }
}
```

> Leave `BILLIT_PARTY_ID` unset (or 0). Claude will auto-discover companies via `billit_get_account_info`.

---

## Multi-Company Flow (Custom)

This server supports multiple Billit companies from a single API key.

**Auto-discovery protocol:**
1. Claude calls `billit_get_account_info` — no PartyID needed
2. Returns all companies with `PartyID`, name, and VAT
3. Claude stores mapping in memory: e.g. `JaRa Productions bv → 208029`
4. All subsequent tool calls pass `company_id` based on context

**Company IDs:** run `billit_get_account_info` to discover your own PartyIDs.

---

## Test Checklist

### 1. Account Discovery
```
billit_get_account_info
```
- [x] Returns Companies array with PartyID, Name, VATNumber
- [x] Works without PartyID header

### 2. Orders
```
billit_list_orders company_id=<your-party-id> direction=Income
```
- [x] Returns outgoing invoices

```
billit_list_orders company_id=<your-second-party-id> direction=Income
```
- [x] Returns outgoing invoices for second company (multi-company)

### 3. Create + Confirm + Send (Happy Path)
```
billit_create_order company_id=<party-id> order_type=Invoice order_direction=Income
  order_date=2026-01-01 customer_name="Test NV" customer_vat=BE0123456789
  lines=[{"description":"Test service","quantity":1,"unit_price_excl":100,"vat_percentage":21}]
```
- [ ] Returns OrderID

```
billit_confirm_order company_id=<party-id> order_id=<id>
```
- [ ] ApprovalStatus = approved

```
billit_send_order company_id=<party-id> order_ids=[<id>]
```
- [ ] Sent successfully

### 4. Parties
```
billit_list_parties company_id=<party-id> party_type=Customer search=Test
```
- [ ] Returns matching customers

```
billit_create_party company_id=<party-id> commercial_name="Test NV" vat_number=BE0123456789
```
- [ ] Returns PartyID

### 5. Products
```
billit_list_products company_id=<party-id>
```
- [ ] Returns product catalog

### 6. Financial Transactions
```
billit_list_financial_transactions company_id=<party-id> top=5
```
- [x] Returns transactions

```
billit_list_financial_transactions company_id=<party-id> orderby="ValueDate desc" top=5
```
- [x] Returns most recent transactions first

```
billit_list_financial_transactions company_id=<party-id> filter="ValueDate ge datetime'2026-01-01T00:00:00'" orderby="ValueDate desc" top=10
```
- [x] Date filter + orderby combined works

```
billit_list_financial_transactions company_id=<party-id> search="<counterparty name>"
```
- [x] Full-text search works — returns matching transactions with Note field

### 7. Documents & Files
```
billit_list_documents company_id=<party-id> top=5
```
- [ ] Returns documents

```
billit_get_order company_id=<party-id> order_id=<confirmed-id>
```
- Find a fileID (UUID) in the response, then:
```
billit_download_file company_id=<party-id> file_id=<uuid>
```
- [ ] Returns base64 PDF content

### 8. Peppol
```
billit_peppol_lookup_participant vat_or_cbe=BE0123456789
```
- [ ] Returns participant info or not-found

```
billit_peppol_list_inbox company_id=<party-id>
```
- [ ] Returns inbox (may be empty)

### 9. Reports
```
billit_list_reports company_id=<party-id> top=5
```
- [ ] Returns available reports

### 10. Error Cases
- Invalid company_id (e.g. 999) → expect 401 or 403
- Invalid order_id → expect 404
- Send unconfirmed order → expect error

---

## v1.1.1 Regression Tests (2026-03-22)

### R1 — JSON.parse error handling
```
billit_create_order company_id=208029 order_type=Invoice order_direction=Income
  order_date=2026-03-22 customer_name="Test NV" lines="INVALID JSON {{broken"
```
- [x] Returns clear error with JSON example — no crash

### R7 — billit_delete_order dry_run
```
billit_delete_order company_id=208029 order_id=999999 dry_run=true
```
- [x] Returns "Dry run: would delete order 999999. No changes made."

### R8 — billit_peppol_unregister dry_run
```
billit_peppol_unregister company_id=208029 dry_run=true
```
- [x] Returns "Dry run: would unregister party from Peppol. No changes made."

### R9 — OData filter wins over party_type
```
billit_list_parties company_id=208029 party_type=Customer filter="PartyType eq 'Supplier'"
```
- [x] Returns Suppliers only — filter takes precedence, no contradictory OData expression

### R13 — billit_get_report accepts string ID
```
billit_list_reports company_id=208029 top=3  → report_id=1
billit_get_report company_id=208029 report_id=1
```
- [x] list_reports returns IDs — get_report works with numeric ID (z.coerce.number)

---

## Coverage Check

```bash
npm run check-coverage
```

Checks that all tools have non-empty descriptions and all params have `.describe()`.

Expected: `✅ Coverage check passed (39 tools, all descriptions and .describe() present)`

---

## Known Quirks

| Issue | Details |
|-------|---------|
| `PartyID: 0` causes misleading 401 | Fixed: header not sent when value is 0 |
| `billit_get_account_info` needs no PartyID | Works without company_id — use for discovery |
| `billit_peppol_lookup_participant` is global | No company context needed — looks up any VAT in Peppol directory |
| OrderDirection naming | `Income` = outgoing sales, `Cost` = incoming purchases (counter-intuitive) |
| fileID vs DocumentID | `billit_download_file` uses UUID string, not numeric DocumentID |
