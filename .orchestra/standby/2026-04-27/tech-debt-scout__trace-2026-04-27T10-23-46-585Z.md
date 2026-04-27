# Tech-Debt Scan — 2026-04-27

## Summary

TRACE is in reasonable health. Production build is clean; all 17 remaining TS errors are confined to test files. The previous scan's empty-catch-block fix was auto-executed and the fs-guard-test removal was promoted — both shipped. Dependency drift remains the biggest standing concern (vite 6→8, tailwind 3→4, typescript 5→6, lucide-react 0.460→1.11), tracked in existing backlog items. This scan surfaces two small new findings: dead API exports in `api.ts` and a missing `vitest/globals` type reference causing 2 of the 17 TS errors.

## Findings

### Finding 1: Dead exports `updateTeam` and `addTeamMember` in api.ts
- **Complexity**: small
- **Estimated files**: 1
- **Public API impact**: no
- **Where**: `frontend/src/services/api.ts` lines 627-644
- **What's wrong**: `updateTeam` (line 627) and `addTeamMember` (line 641) are exported but never imported anywhere in the codebase. The actual team-member addition goes through `adminAddTeamMember` (line 829), which uses a different endpoint shape (`/admin/teams/{id}/members` with `{email, role}` payload vs `/teams/{id}/members` with `{user_id, role}`). These dead functions point to a stale non-admin teams API that was superseded by the admin variant.
- **Suggested fix**: Remove `updateTeam` and `addTeamMember` from api.ts. If the non-admin team endpoints are still needed in the backend, keep them there but don't ship unused frontend bindings.
- **Why now**: Dead exports increase cognitive load in a 1034-line file with 120 exports. They also risk being called accidentally by a future developer who doesn't realize the admin variant is the correct one.

### Finding 2: Missing `vitest/globals` types in tsconfig.json
- **Complexity**: small
- **Estimated files**: 1
- **Public API impact**: no
- **Where**: `frontend/tsconfig.json`
- **What's wrong**: The vite config (`vite.config.ts`) sets `test.globals: true`, making `beforeEach`, `afterAll`, etc. available at runtime without imports. But `tsconfig.json` doesn't include `"types": ["vitest/globals"]` in `compilerOptions`, so TypeScript can't find these globals. This causes 2 TS2304 errors in `frontend/src/test/setup.ts` (lines 18, 21): `Cannot find name 'beforeEach'` and `Cannot find name 'afterAll'`.
- **Suggested fix**: Add `"types": ["vitest/globals"]` to `compilerOptions` in `frontend/tsconfig.json`. This resolves 2 of the 17 remaining TS errors with a one-line config change.
- **Why now**: This is the simplest possible reduction of the TS error count. One line, zero risk.

## Existing backlog items — status update

| ID | Title | Status | Notes |
|---|---|---|---|
| trace-td-20260426-001 | Fix TS errors in test files | draft | Down from 26→17. 9 fixed by recent work. Remaining: 11 unused-var (TS6133), 3 StackFrame (TS2353), 1 header type (TS2339), 2 vitest globals (TS2304, see Finding 2 above) |
| trace-td-20260426-002 | Decompose TriageDetailPage.tsx | draft | Still 2248 lines, unchanged |
| trace-td-20260426-003 | Split triage.py routes | draft | Still 1373 lines, unchanged |
| trace-td-20260426-005 | Upgrade vite 6→8 + plugin-react | draft | vite now at 8.0.10 latest (was 8.x last scan) |
| trace-td-20260427-001 | Replace empty catch blocks | auto-executed | Completed via TASK-629C016D |
| trace-td-20260427-002 | Remove fs guard tests | promoted | Via TASK-E11CE1D7 |
| trace-td-20260427-003 | Fix StackFrame type mismatch | draft | Still present, 3 errors |
