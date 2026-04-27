# Tech-Debt Scan — 2026-04-27

## Summary

TRACE is in reasonable shape. Production TypeScript build is clean (test-only TS errors remain at 26). The four oversized page components and triage.py route file flagged yesterday are unchanged. Two new findings today: (1) nine swallowed `catch` blocks across three page components silently discard errors with no logging or user feedback, and (2) `reportTab.test.tsx` uses Node.js `fs`/`path`/`__dirname` directly in a Vitest browser-context test, causing three TS errors and fragile coupling to filesystem layout. Dependency drift is stable — no new major gaps since yesterday.

## Findings

### Finding 1: 9 empty catch blocks swallow errors silently
- **Complexity**: small
- **Estimated files**: 3
- **Public API impact**: no
- **Where**: `frontend/src/pages/AdminPage.tsx` (lines 111, 345, 500, 637, 1166), `frontend/src/pages/SettingsPage.tsx` (line 514), `frontend/src/pages/AppDetailPage.tsx` (lines 1687, 1698, 1711)
- **What's wrong**: Nine `catch` blocks contain only `// silently fail` with no logging, toast, or error boundary notification. When API calls fail in these handlers, the user gets zero feedback — the UI just does nothing. This makes debugging production issues harder and violates the TRACE brand voice rule: "always say what went wrong."
- **Suggested fix**: Replace each empty catch with a call to the existing toast/notification system (e.g. `toast.error("Failed to …")`) or at minimum `console.error(err)`. Can be done mechanically — each catch wraps a single API call whose purpose is clear from context.
- **Why now**: These are user-facing mutation handlers (invite user, create org, delete app, etc). Silent failures erode trust and make support tickets harder to resolve.

### Finding 2: reportTab.test.tsx uses Node.js fs/path builtins causing TS errors
- **Complexity**: small
- **Estimated files**: 1
- **Public API impact**: no
- **Where**: `frontend/src/test/pages/reportTab.test.tsx` (lines 14-15, 89-105)
- **What's wrong**: The test imports `fs` and `path` and uses `__dirname` to verify the auto-executed rename (ReportsPage → ReportTab) by reading files from disk. This causes 4 of the 26 TS errors (`Cannot find module 'fs'`, `Cannot find module 'path'`, `Cannot find name '__dirname'` ×2). These "structural guard" tests are brittle — they test filesystem layout rather than runtime behavior — and they've already served their purpose since the rename shipped.
- **Suggested fix**: Delete the three filesystem-based test cases (lines 89-107). The remaining test in the file already verifies the component renders correctly, which is sufficient. Alternatively, if filesystem guards are desired, add `@types/node` to devDependencies and configure the test tsconfig for Node types.
- **Why now**: These contribute 4 of the 26 outstanding TS errors. Removing them is the lowest-effort way to reduce the error count.

### Finding 3: StackFrame type mismatch in triageDetailPage test (existing — still open)
- **Complexity**: small
- **Estimated files**: 2
- **Public API impact**: no
- **Where**: `frontend/src/test/pages/triageDetailPage.test.tsx` (lines 1729-1731), `frontend/src/types/api.ts` (lines 163-168)
- **What's wrong**: Test fixtures use `{ method: "..." }` for `StackFrame` objects, but the `StackFrame` interface defines `symbol_name`, not `method`. This causes TS2353 errors. The test data doesn't match the actual API contract.
- **Suggested fix**: Replace `method` with `symbol_name` in the three test fixture objects at lines 1729-1731.
- **Why now**: Three easy TS errors to eliminate. Keeps test fixtures aligned with the actual type contract.

### Finding 4: 26 TS errors in test files (carried from yesterday — tracking update)
- **Complexity**: small
- **Estimated files**: 7
- **Public API impact**: no
- **Where**: Multiple test files (see `npx tsc --noEmit` output)
- **What's wrong**: 26 TypeScript errors, all in test files. Breakdown: ~14 unused imports/variables (TS6133), 4 Node.js module errors (Finding 2), 3 StackFrame mismatches (Finding 3), 2 missing vitest globals in setup.ts, 1 Authorization header type error, 2 misc.
- **Suggested fix**: Fix in priority order: (a) remove unused imports/vars, (b) fix StackFrame fixtures, (c) delete fs-based tests or add @types/node, (d) add vitest types to test setup tsconfig.
- **Why now**: Same as yesterday — these prevent `tsc --noEmit` from passing cleanly. Findings 2 and 3 above address 7 of the 26.

### Finding 5: TriageDetailPage.tsx at 2248 lines (carried — unchanged)
- **Complexity**: medium
- **Estimated files**: 4-6
- **Public API impact**: no
- **Where**: `frontend/src/pages/TriageDetailPage.tsx`
- **What's wrong**: Single component file at 2248 lines. Contains diagnosis display, stack trace viewer, solve controls, history, and multiple sub-sections that could be extracted.
- **Suggested fix**: Extract logical sections (stack trace viewer, solve controls, diagnosis panel) into separate component files under `components/triage/`.
- **Why now**: Ongoing maintainability concern. Not urgent but compounds with each feature addition.

### Finding 6: triage.py routes at 1373 lines (carried — unchanged)
- **Complexity**: medium
- **Estimated files**: 3-4
- **Public API impact**: no
- **Where**: `backend/app/api/routes/triage.py`
- **What's wrong**: Largest backend route file at 1373 lines. Mixes CRUD, triage execution, solve orchestration, and history endpoints.
- **Suggested fix**: Split into `triage_crud.py`, `triage_solve.py`, `triage_history.py` and register sub-routers.
- **Why now**: Same as yesterday — any new triage feature grows this file further.

### Finding 7: Major dependency drift (carried — unchanged)
- **Complexity**: medium
- **Estimated files**: 2-3
- **Public API impact**: no
- **Where**: `frontend/package.json`
- **What's wrong**: Major version gaps: vite 6→8, @vitejs/plugin-react 4→6, lucide-react 0.460→1.11, jsdom 25→29, tailwindcss 3→4, typescript 5→6, react-markdown 9→10.
- **Suggested fix**: Tackle in order: (1) vite+plugin-react together, (2) tailwindcss (breaking config changes), (3) typescript, (4) lucide-react (icon API changes), (5) jsdom+react-markdown.
- **Why now**: Vite 8 and Tailwind 4 are the biggest gaps. Longer you wait, the harder the migration.
