<!-- orchestrate handoff
task: s10-api
branch: orch/s10-filter-csv/s10-api
agentId: bc-7060a376-07ef-48d3-a9a4-2503623c129a
runId: run-7072bd58-b498-4eef-862c-81f7608f34d5
resultStatus: finished
finishedAt: 2026-08-16T18:54:24.972Z
-->

## Status
success

## Branch
`orch/s10-filter-csv/s10-api`

## What I did
- **`packages/harness/src/scheduler.ts`**: Added `LeadListFilters` and extended `listLeadRows(db, filters?)` with AND filtering on `status` / `oppStage`; added `importLeadsFromCsv(ctx, { csv, role })` with inline CSV parsing, duplicate skip, viewer 403 via `HarnessError`, and `rebuildLeadVec` after successful inserts.
- **`packages/harness/src/index.ts`**: Exported `importLeadsFromCsv`, `CsvImportResult`, and `LeadListFilters`.
- **`apps/api/src/router.ts`**: Parsed `status` / `stage` on `GET /api/leads` (400 on unknown values); registered `POST /api/leads/import` before the `/api/leads/:id` matcher.
- **`packages/harness/src/scheduler.test.ts`**: S10 describe block for seed filter locks, CSV import (two new companies, skip 橙果素质教育, no accounts), viewer 403.
- **`apps/api/src/router.test.ts`**: HTTP cases for filters, import ACL/behavior, and route-order sanity (`GET /api/leads/import` → 404).

## Measurements
- `npm test (excl golden)`: 71 passing → 82 passing
- `packages/harness/src/scheduler.test.ts` S10 cases: 0 → 5
- `apps/api/src/router.test.ts` S10 cases: 0 → 6
- `GET /api/leads?status=新线索` includes 橙果素质教育: absent → verified in tests
- `GET /api/leads?stage=方案报价` includes 杭齿精密机电 + 邻里鲜超市: absent → verified in tests
- `GET /api/leads?stage=not-a-stage`: no 400 → 400 in tests
- `POST /api/leads/import` viewer: no endpoint → 403, zero inserts in tests
- `POST /api/leads/import` sales: no endpoint → 新线索 rows inserted, 橙果 skipped, no accounts/opportunities in tests

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- CSV parser is hand-rolled (no npm dep per spec); handles BOM, quoted fields, and trailing blank lines.
- New lead ids use `lead-csv-<slug>-<n>` with collision check against existing ids.
- `GET /api/leads/import` still resolves to 404 (no lead named “import”); only `POST /api/leads/import` is the import route — matches brief route-order intent.
- Shared harness test ctx mutates DB across S10 import tests; filter assertions remain valid on seed data.
- Did not modify `apps/web`, `apps/web-demo`, or `docs` per scope.

## Suggested follow-ups
- Web worker: stage chips, `getLeads(role, query?)`, `importLeadsCsv(role, csv)`, CSV toolbar in `apps/web`.
- Docs worker: `docs/contracts/S10.md`, `docs/checklists/S10.md`, `r6.test.ts` UI assertions, timeline update.
- Planner: integrate `s10-spec` + `s10-api` (+ web branch) and open integration PR.