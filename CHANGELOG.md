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
- Real client data (names, PartyIDs) in docs and describe() examples replaced with placeholders (Task 08)
- `skip=0` and `top=0` silently dropped due to falsy checks — now uses `!== undefined` in all 7 files (Task 11)
- Peppol lookup errors silently treated as "not registered" — now surfaces actual error messages (Task 12)
- `content_type` in `billit_import_financial_transactions` required but should be optional (Task 13)
- `since_date` describe() text hardcoded "2026-01-01" — now says "start of current year" (Task 13)

### Added
- `dry_run` parameter on `billit_delete_order` and `billit_peppol_unregister` (R7, R8)
- Bidirectional llmTip sync between code and GUIDELINES-BILLIT.md (R11)
- `withLlmTip()` helper — `<llmTip>` XML tags appended to tool descriptions for API quirks (Task 09)
- 14 WARNING/NOTE/CRITICAL blocks migrated from description text to llmTip in 6 tool files (Task 09)

### Changed
- Extracted shared `companyId` schema, `respond()` helper, and `coerceBool` to `src/tools/utils.ts` (R14, Task 13)

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
