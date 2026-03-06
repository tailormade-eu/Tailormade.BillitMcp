# Changelog

## [1.0.0] — 2026-03-06

### Initial release

- 39 tools covering 55 Billit API endpoints
- Multi-company support via `company_id` param on all tools
- Auto-discovery: `billit_get_account_info` works without PartyID, returns all linked companies
- Categories: Orders, Parties, Products, Peppol, Documents, Financial, ToProcess
- OData filtering on list endpoints (`$filter`, `$top`, `$skip`)
- Full-text search via `fullTextSearch` query param (separate from OData)
- `npm run check-coverage` script to verify tool coverage vs INDEX.md
