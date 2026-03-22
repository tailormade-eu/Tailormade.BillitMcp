# Changelog

## [1.1.1] - 2026-03-22

### Fixed
- `vat_or_cbe` not URL-encoded in peppol lookup path — added `encodeURIComponent()` (Task 21, CR16/W8)
- `buildODataParams` accepted whitespace-only filter strings — now uses `filter?.trim()` (Task 21, CR17)
- `since_date` in workflows.ts lacked input validation — added ISO 8601 regex to prevent OData injection (Task 20, CR15)
- `withLlmTip()` separator missing trailing newline — now `\n\n---\n\n` for correct markdown rendering (Task 22, S7)
- `NOTE:` blocks still in description for 3 tools — moved to `withLlmTip()` (Task 14, CR10)
- Silent catch on full-order-fetch in `billit_peppol_send_report` — now surfaces errors with `fetch_failed` bucket (Task 15, CR11)
- `withLlmTip()` used XML `<llmTip>` tags — replaced with plain `---` separator (Task 16, CR12)
- Missing `unhandledRejection` handler — server died silently on async errors (Task 17, W1)
- OData `modified_after` injection — added ISO 8601 regex validation (Task 17, W2)
- Workflow pagination infinite loop risk — added MAX_PAGES=100 safeguard (Task 17, W3)
- `client.ts` falsy check on `partyId`/`contextPartyId` inconsistent with `!== undefined` fix (Task 17, CR13)
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
- `dry_run` parameter on 14 write tools: delete_order, peppol_unregister, create/update/confirm/send_order, register_payment, create/update_party, create_product, peppol_send_order, submit/cancel_processing, import_financial_transactions (R7, R8, Task 18, Task 19, CR14)
- `company_id` param on `billit_peppol_lookup_participant` — consistent with all other peppol tools (Task 18, S6)
- `buildODataParams()` helper in utils.ts — replaces inline URLSearchParams in 7 list-tools (Task 18, S5)
- Bidirectional llmTip sync between code and GUIDELINES-BILLIT.md (R11)
- `withLlmTip()` helper — plain `---` separator appended to tool descriptions for API quirks (Task 09, Task 16)
- 14 WARNING/NOTE/CRITICAL blocks migrated from description text to llmTip in 6 tool files (Task 09)

### Changed
- Extracted shared `companyId` schema, `respond()` helper, `coerceBool`, `buildODataParams()`, and `currentYearStart()` to `src/tools/utils.ts` (R14, Task 13, Task 18)
- `check-coverage` script now also validates `coerceBool` params have `.describe()` and skips `companyId` (has built-in describe) (Task 18, S1)
- PartyType regex tightened from `/PartyType/i` to `/PartyType\s+eq\b/i` to prevent false positives (Task 18, S3)

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
