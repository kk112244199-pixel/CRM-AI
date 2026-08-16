<!-- orchestrate handoff
task: s10-spec
branch: orch/s10-filter-csv/s10-spec
agentId: bc-4805c6b0-5947-4419-9502-ddab876e7391
runId: run-6375ce8d-1399-4e57-81e8-fba3dac8bd3d
resultStatus: finished
finishedAt: 2026-08-16T18:49:54.837Z
-->

## Status
success

## Branch
`orch/s10-filter-csv/s10-spec`

## What I did
- Confirmed cited paths still exist: `apps/api/src/router.ts`, `packages/harness/src/scheduler.ts`, `apps/web/src/App.tsx`, `apps/web/src/api.ts`, `docs/contracts/S9.md`, M0–M6.
- Created `docs/s10-brief.md` locking S10 semantics: GET `/api/leads?status=&stage=` (AND filters, 400 on unknown values, seed locks), POST `/api/leads/import` (CSV columns, ACL, skip/errors, `rebuildLeadVec`), web stage chips + CSV toolbar, later test/doc targets, and forbidden items.
- Committed and pushed to `orch/s10-filter-csv/s10-spec`. No application source files modified.

## Measurements
- `docs/s10-brief.md`: absent → 112 LOC
- application files changed: 0 → 0

## Verification
not-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Current code matches task brief: `listLeadRows(db)` has no filter args; `GET /api/leads` has no query parsing; web tabs are client-side only; no import endpoint exists.
- Brief references `LEAD_STATUSES` / `OPP_STAGES` from `@hengce/domain` (confirmed in `packages/domain/src/enums.ts`).
- `rebuildLeadVec` lives in `@hengce/domain` and is already used at API startup (S9); import spec requires calling it after successful CSV inserts.
- No PR opened per branch discipline; planner owns integration.

## Suggested follow-ups
- Worker: implement `listLeadRows(db, { status?, stage? })` in `packages/harness` + wire `GET /api/leads` query params in `apps/api/src/router.ts`.
- Worker: implement CSV parse/import helper in `packages/harness` + `POST /api/leads/import` with viewer 403 and `rebuildLeadVec` on success.
- Worker: web stage chips, `getLeads(role, query?)`, `importLeadsCsv(role, csv)`, CSV file input on list toolbar.
- Worker: `router.test.ts`, harness filter/import tests, `r6.test.ts` UI/api assertions.
- Worker: finalize `docs/contracts/S10.md`, `docs/checklists/S10.md`, update `docs/skill-timeline.md` and prior contracts' 下一刀 sections.