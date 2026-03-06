# Billit API — INDEX

**Base URL:** `https://api.billit.be`
**Docs:** https://docs.billit.be/reference
**Auth:** Headers `ApiKey` + `PartyID` + optional `ContextPartyID`
**Pagination:** OData `$top` / `$skip` + `$filter`

---

## Orders (Invoices / Credit Notes)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/orders` | GET | List orders. OData filter + fullTextSearch |
| `/v1/orders` | POST | Create new order |
| `/v1/orders/{orderID}` | GET | Order detail incl. OrderLines |
| `/v1/orders/{orderID}` | PATCH | Update order (Paid, PaidDate, IsSent, ApprovalStatus, ...) |
| `/v1/orders/{orderID}` | DELETE | Delete order |
| `/v1/orders/{orderID}/bookingEntries` | PUT | Update accounting entries |
| `/v1/orders/{orderID}/payments` | POST | Register payment |
| `/v1/orders/commands/send` | POST | Send order (email/Peppol) |
| `/v1/orders/deleted` | GET | List deleted orders |

### Order fields (GET response)
- `OrderID` (int), `OrderNumber` (string), `OrderDate` (date), `OrderType` ("Invoice"|"CreditNote"|"Offer")
- `OrderDirection` ("Income"|"Cost"), `OrderTitle` (string), `Reference` (PO number)
- `Currency` (default "EUR"), `PaymentReference` (structured communication)
- `TotalAmountInclVat`, `TotalAmountExclVat`, `TotalVatAmount` (decimal)
- `Customer` / `Supplier` / `CounterParty` (Party object)
- `ApprovalStatus` ("none"|"approved"|"rejected")
- `IsSent` (bool), `Paid` (bool), `PaidDate` (date)
- `LastModified` (datetime), `DeliveryDate`, `ExpiryDate`
- `OrderLines` [ { `Description`, `DescriptionExtended`, `Quantity`, `UnitPriceExcl`, `VATPercentage`, `Reference` } ]

### POST /v1/orders — minimal example
```json
{
  "OrderType": "Invoice",
  "OrderDirection": "Income",
  "OrderDate": "2026-03-06",
  "Customer": {
    "Name": "Customer NV",
    "VATNumber": "BE0123456789",
    "PartyType": "Customer",
    "Email": "info@customer.be",
    "Language": "NL",
    "Addresses": [{ "AddressType": "InvoiceAddress", "Street": "Street", "StreetNumber": "1", "City": "Ghent", "Zipcode": "9000", "CountryCode": "BE" }]
  },
  "OrderLines": [
    { "Quantity": 1, "UnitPriceExcl": 100.0, "Description": "Service", "VATPercentage": 21 }
  ]
}
```

### PATCH /v1/orders/{orderID} — patchable fields
`Paid`, `PaidDate`, `IsSent`, `ApprovalStatus`, `InternalInfo`, `AccountCode`, `Invoiced`, `AccountantVerificationNeeded`, `ExportedToConnector`

### OData filter examples
- `OrderDirection eq 'Income'` — outgoing
- `OrderDirection eq 'Cost'` — incoming
- `OrderType eq 'Invoice'` — invoices
- `OrderType eq 'CreditNote'` — credit notes
- `LastModified ge datetime'2026-01-01T00:00:00'`
- `ApprovalStatus eq 'none'` — not yet confirmed

---

## Parties (Customers / Suppliers)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/parties` | GET | List parties. OData filter + fullTextSearch |
| `/v1/parties` | POST | Create new party |
| `/v1/parties/{partyID}` | GET | Party detail |
| `/v1/parties/{partyID}` | PATCH | Update party |

### Party fields
- `PartyID` (int), `CommercialName` / `DisplayName` (string)
- `VATNumber`, `EnterpriseNumber`
- `PartyType` ("Customer"|"Supplier"|"Both")
- `CustomerNumber`, `SupplierNumber`
- `Email`, `Phone`, `Language` ("NL"|"FR"|"EN"|"DE")
- `Addresses` [ { `AddressType` ("InvoiceAddress"|"DeliveryAddress"), `Name`, `Street`, `StreetNumber`, `Box`, `Zipcode`, `City`, `CountryCode`, `Phone` } ]
- `Identifiers` [ { `IdentifierType` ("GLN"|"VAT"|...), `Identifier` } ]
- `IBAN`, `BIC`

---

## Products

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/products` | GET | List products |
| `/v1/products/{productID}` | GET | Product detail |
| `/v1/products` | POST | Create or update product |

### Product fields
- `ProductID`, `Description`, `Reference`, `UnitPrice`, `VATPercentage`, `Unit`

---

## Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/documents` | GET | List documents. fullTextSearch |
| `/v1/documents` | POST | Upload document |
| `/v1/documents/{documentID}` | GET | Get document |

---

## Files

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/files/{fileID}` | GET | Download file (UUID) |

---

## Financial Transactions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/financialTransactions` | GET | List transactions. fullTextSearch + OData `$filter` / `$orderby` / `$top` / `$skip` |
| `/v1/financialTransactions/importFile` | POST | Upload bank file (CODA/MT940) |
| `/v1/financialTransactions/commands/import` | POST | Import transactions |

---

## GL Accounts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/glaccounts` | POST | Create GL account |
| `/v1/glaccounts/commands/import` | POST | Batch import GL accounts |

---

## Journals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/journals/commands/import` | POST | Import journals |

---

## Peppol

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/peppol/participants` | POST | Register as Peppol participant |
| `/v1/peppol/participants` | DELETE | Unregister as Peppol participant |
| `/v1/peppol/inbox` | GET | Incoming Peppol messages |
| `/v1/peppol/inbox/{inboxItemId}/confirm` | POST | Accept message |
| `/v1/peppol/inbox/{inboxItemID}/refuse` | POST | Refuse message |
| `/v1/peppol/sendOrder` | POST | Send order via Peppol |
| `/v1/peppol/participantInformation/{VATorCBE}` | GET | Lookup Peppol participation by VAT/CBE |

---

## Accountant Feeds

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/accountant/feeds` | GET | List all feeds to download (poll max once/min) |
| `/v1/accountant/feeds` | POST | Register new feed — newly exported orders/docs will appear in it |
| `/v1/accountant/feeds` | DELETE | Remove a feed |
| `/v1/accountant/feeds/confirm` | POST | Confirm successfully downloaded feed items (removes them from feed list) |
| `/v1/accountant/files/{fileID}` | GET | Download a file (e.g. CODA) from the feed |

---

## Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/reports` | GET | List reports |
| `/v1/reports/{reportID}` | GET | Get report |

---

## Account

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/account/accountInformation` | GET | Get account info |
| `/v1/account/ssoToken` | GET | Get SSO token |
| `/v1/account/sequences` | POST | Manage number sequences |
| `/v1/account/registercompany` | POST | Register company |

---

## Misc

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/misc/companysearch/{Keywords}` | GET | Company lookup (KBO/VAT) |
| `/v1/misc/typecodes/{TypeCodeType}` | GET | List type codes (VAT, units, ...) |
| `/v1/misc/typecodes/{TypeCodeType}/{key}` | GET | Get type code translation |

---

## ToProcess

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/toProcess` | POST | Submit a file/document for processing (upload) |
| `/v1/toProcess/{uploadID}` | DELETE | Cancel/remove an upload |

---

## Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/webhooks` | POST | Create webhook |
| `/v1/webhooks` | GET | List webhooks |
| `/v1/webhooks` | DELETE | Delete webhook |
| `/v1/webhooks/refresh` | POST | Refresh webhook |

---

## OAuth2

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/OAuth2/token` | POST | Get access token (client_credentials / auth_code) |
| `/OAuth2/revoke` | POST | Revoke token |
