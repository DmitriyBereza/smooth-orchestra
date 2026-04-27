# Tech-Debt Scan — 2026-04-26

## Summary

TRACE is in reasonable health overall. The production build typechecks cleanly (all 19 TS errors are confined to test files). Key concerns: (1) test files have type errors that indicate stale test data vs. updated interfaces, (2) several page components exceed 1200+ lines with no decomposition, (3) a dead/orphan page (`ReportsPage`) is flagged for deletion but still exists, (4) major version drift on `vite` (6→8), `@vitejs/plugin-react` (4→6), and `lucide-react` (0.460→1.11). No critical security or runtime issues found.

## Findings

### Finding 1: Test files have 19 TypeScript errors (stale types & unused imports)

- **Complexity**: small
- **Estimated files**: 7
- **Public API impact**: no
- **Where**: `frontend/src/test/pages/triageDetailPage.test.tsx`, `frontend/src/test/services/api.test.ts`, `frontend/src/test/components/incidentCard.test.tsx`, `frontend/src/test/components/toast.test.tsx`, `frontend/src/test/pages/adminPage.test.tsx`, `frontend/src/test/pages/dashboardPage.test.tsx`, `frontend/src/test/pages/solveReviewPage.test.tsx`, `frontend/src/test/setup.ts`
- **What's wrong**: Tests reference properties (`method`, `line_no`, `is_app_code`) that no longer exist on `StackFrame` (which now has `scope_name`, `symbol_name`, `line_number`, `file_path`). Multiple unused imports (`vi`, `afterEach`, `waitFor`, `within`, `Routes`, `Route`) trigger `TS6133`. `setup.ts` references `beforeEach`/`afterAll` without importing from vitest.
- **Suggested fix**: Update test object literals to match current `StackFrame` interface; remove unused imports; add vitest globals import to `setup.ts` or configure `globals: true` in vitest config.
- **Why now**: These mask real type regressions — if a real type error is introduced in test code, it's invisible in the noise of 19 existing errors.

### Finding 2: TriageDetailPage.tsx is 2248 lines — needs decomposition

- **Complexity**: medium
- **Estimated files**: 3-5
- **Public API impact**: no
- **Where**: `frontend/src/pages/TriageDetailPage.tsx` (2248 lines), `frontend/src/pages/AppDetailPage.tsx` (1984 lines)
- **What's wrong**: Single-file components at 2000+ lines are hard to navigate, test in isolation, and code-review. Both pages contain multiple logical sections (detail panels, action bars, tab content, modals) that could be extracted.
- **Suggested fix**: Extract sub-components into `frontend/src/pages/triage-detail/` and `frontend/src/pages/app-detail/` directories with an `index.tsx` barrel re-export. Start with the most self-contained sections (modals, tab panels).
- **Why now**: These files will only grow. Each new feature touching triage detail adds to the cognitive load and merge-conflict surface.

### Finding 3: `backend/app/api/routes/triage.py` is 1373 lines

- **Complexity**: medium
- **Estimated files**: 3-4
- **Public API impact**: no (internal route module split)
- **Where**: `backend/app/api/routes/triage.py`
- **What's wrong**: A single route module handling all triage-related endpoints. At 1373 lines it likely contains multiple concerns (CRUD, search, solve actions, history) that could be separated into sub-routers.
- **Suggested fix**: Split into `triage/routes.py`, `triage/solve.py`, `triage/history.py` with a shared `triage/deps.py` for common dependencies. Wire sub-routers via an `APIRouter` prefix group.
- **Why now**: This is the most-touched backend file and a common source of merge conflicts in multi-feature development.

### Finding 4: Dead page `ReportsPage.tsx` marked for deletion

- **Complexity**: small
- **Estimated files**: 2
- **Public API impact**: no
- **Where**: `frontend/src/pages/ReportsPage.tsx`, `frontend/src/pages/InsightsPage.tsx`
- **What's wrong**: `ReportsPage.tsx` has a TODO from commit `c258306` saying "delete or merge fully into InsightsPage when InsightsPage is stable." It's imported by `InsightsPage` as a sub-component — it should either be inlined into InsightsPage or renamed to reflect it's a sub-component, not a standalone page.
- **Suggested fix**: Rename to `ReportTab.tsx` or inline its content into InsightsPage. Remove the "page" framing (it's not routed directly).
- **Why now**: The naming is misleading — it looks like a dead route but is actually an active sub-component. Low effort to clarify.

### Finding 5: Major version drift on vite (6→8) and @vitejs/plugin-react (4→6)

- **Complexity**: medium
- **Estimated files**: 2-4
- **Public API impact**: no
- **Where**: `frontend/package.json`, potentially `vite.config.ts`
- **What's wrong**: `vite` is at 6.4.1 (latest: 8.0.10, 2 majors behind). `@vitejs/plugin-react` is at 4.7.0 (latest: 6.0.1). `lucide-react` is at 0.460.0 (latest: 1.11.0 — breaking icon API changes likely). `jsdom` is at 25.0.1 (latest: 29.0.2).
- **Suggested fix**: Upgrade vite + plugin-react together (they're coupled). lucide-react 1.x may require import path changes. Handle each major bump as a separate PR.
- **Why now**: Vite 8 likely includes security patches and build performance improvements. The longer you wait, the harder the migration. However, this isn't urgent — no known vulnerabilities in current versions.
