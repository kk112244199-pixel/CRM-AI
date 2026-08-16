<!-- orchestrate handoff
task: s10-web
branch: orch/s10-filter-csv/s10-web
agentId: bc-7ff23ed1-9f7e-46b5-beec-c59b711c1b08
runId: run-f62de5d8-a406-472d-bf18-f1946be3be47
resultStatus: finished
finishedAt: 2026-08-16T18:52:59.879Z
-->

## Status
success

## Branch
`orch/s10-filter-csv/s10-web`

## What I did
- **`apps/web/src/api.ts`**: Added `LeadsQuery`, `getLeads(role, { status?, stage? })` with `URLSearchParams`, and `importLeadsCsv(role, csv)` POSTing `{ csv }` to `/api/leads/import` with existing headers.
- **`apps/web/src/types.ts`**: Added `ImportLeadsResult` for the import response shape.
- **`apps/web/src/App.tsx`**: Refactored `ListPage` to server-fetch by tab/stage (`未转化` → `status=新线索`, `已转化` → `status=已转化`, stage chips toggle `stage=`, `待确认` stays client-side on `pendingIds`). Added five stage chips and CSV file input + `导入 CSV` for sales/manager only (hidden for viewer). Import shows imported/skipped counts in notice flash and reloads the filtered list.
- **`apps/web/src/styles.css`**: Added `.import-csv` styles reusing `.filter` / `.ghost` patterns; no funnel changes.
- **`apps/web/src/r6.test.ts`**: Asserted stage chip labels, `导入 CSV`, `/api/leads/import`, and query-param leads fetch; still blocks emoji / `CURSOR_API_KEY` / `@cursor/sdk`.

## Measurements
- `LOC(apps/web/src/api.ts): 127 → 151`
- `LOC(apps/web/src/App.tsx): 1080 → 1161`
- `LOC(apps/web/src/types.ts): 96 → 102`
- `LOC(apps/web/src/styles.css): 1046 → 1074`
- `LOC(apps/web/src/r6.test.ts): 68 → 76`
- `npm --prefix apps/web test`: 4 passing → 4 passing`
- `apps/web-demo files changed`: 0 → 0`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- `ListPage` now maintains its own filtered fetch; parent `refreshAll()` still loads unfiltered leads for detail sidebar / ingest dropdown.
- On fetch failure (e.g. backend filter endpoint not yet deployed), list shows empty rather than stale data — acceptable until sibling API branch lands.
- `tsc --noEmit && vite build` passes locally.
- No live UI recording: backend import/filter endpoints not available in this VM; behavior verified via unit tests and typecheck/build.

## Suggested follow-ups
- Integrate sibling `s10-api` branch implementing `GET /api/leads?status=&stage=` and `POST /api/leads/import`.
- Manual verify: 未转化 tab → only 新线索; 方案报价 chip → 杭齿/邻里鲜 per seed locks.
- Planner: merge `s10-web` + `s10-api` + finalize `docs/contracts/S10.md` and harness/router tests.