# Changelog

## [1.1.1] - 2026-03-22

### Fixed
- Crash on invalid JSON in `billit_create_order` lines parameter (R1)
- TypeError when API returns null OrderDate in workflows (R2)
- Unbounded concurrency in Peppol lookups — now capped at 5 concurrent (R3)
- `check-coverage` script showed single char on failure instead of full param name (R10)
- `check-coverage` output falsely claimed endpoint coverage — now accurately describes what it checks (R5)
- Server version hardcoded `1.0.0` — now reads dynamically from package.json (R6)
- `billit_get_report` used strict `z.number()` instead of `z.coerce.number()` (R13)
- OData filter conflict in `billit_list_parties` when user filter already contains PartyType (R9)
- Hardcoded `2026-01-01` default date in workflows — now uses dynamic current year (R15)

### Added
- `dry_run` parameter on `billit_delete_order` and `billit_peppol_unregister` (R7, R8)
- Bidirectional llmTip sync between code and GUIDELINES-BILLIT.md (R11)

### Changed
- Extracted shared `companyId` schema and `respond()` helper to `src/tools/utils.ts` (R14)

---

## [1.0.0] — 2026-03-06

### Initial release

- 39 tools covering 55 Billit API endpoints
- Multi-company support via `company_id` param on all tools
- Auto-discovery: `billit_get_account_info` works without PartyID, returns all linked companies
- Categories: Orders, Parties, Products, Peppol, Documents, Financial, ToProcess
- OData filtering on list endpoints (`$filter`, `$orderby`, `$top`, `$skip`)
- Full-text search via `fullTextSearch` query param (separate from OData)
- `npm run check-coverage` script to verify tool coverage vs INDEX.md
