# Tech-Debt Scan — 2026-04-26

## Summary

TRACE is in reasonable shape for a fast-moving product — 122 backend tests, strict TypeScript in production code, and a coherent design system. The main structural concern is two God-object files: `TriageDetailPage.tsx` (2248 lines, 30+ nested functions) and `triage.py` (1373 lines, 21 routes) which have absorbed too many concerns and will become painful to modify. Two quicker wins: the test TypeScript config is missing `vitest/globals` causing 4 real TS errors in `setup.ts`, and hardcoded hex color values are scattered across 4 chart components instead of referencing a shared JS constant. There is also meaningful major-version drift in `vite` (6→8), `tailwindcss` (3→4), and `lucide-react` (0.460→1.11) — each carries known breaking changes that will only compound if deferred.

---

## Findings

### Finding 1: Test tsconfig missing `vitest/globals` types
- **Complexity**: small
- **Estimated files**: 1
- **Public API impact**: no
- **Where**: `frontend/tsconfig.json`
- **What's wrong**: `frontend/src/test/setup.ts` uses `beforeEach` and `afterAll` as globals (vitest `globals: true` in vite.config.ts), but `tsconfig.json` has no `"types": ["vitest/globals"]` entry. `tsc --noEmit` surfaces:
  ```
  src/test/setup.ts(18,1): error TS2304: Cannot find name 'beforeEach'.
  src/test/setup.ts(21,1): error TS2304: Cannot find name 'afterAll'.
  ```
  Downstream test files also get spurious unused-import errors because those globals don't resolve.
- **Suggested fix**: Add `"types": ["vitest/globals"]` to the `compilerOptions.types` array in `frontend/tsconfig.json`. One line.
- **Why now**: `tsc --noEmit` is noisy; teams start ignoring TS errors in CI when they accumulate. Also the unused-variable errors in test files (TS6133) mask real mistakes.

---

### Finding 2: Hardcoded hex colors in chart components — no shared constant
- **Complexity**: medium
- **Estimated files**: 4
- **Public API impact**: no
- **Where**:
  - `frontend/src/pages/DashboardPage.tsx:33-37` — `SEV_COLORS` map with all 4 severity hex values
  - `frontend/src/pages/TeamDashboardPage.tsx:152-153` — inline `fill` props for Recharts cells
  - `frontend/src/pages/AppDetailPage.tsx:1935-1944` — inline `border` / `color` styles
  - `frontend/src/pages/AdminPage.tsx:1260` — inline `border` style
- **What's wrong**: CLAUDE.md rule: "Never hardcode hex values inline — always use the token." Recharts SVG attributes can't consume CSS variables directly, so a JS-side constant is the correct bridge — but right now it's defined ad-hoc in `DashboardPage.tsx` and not shared. `TeamDashboardPage.tsx`, `AppDetailPage.tsx`, and `AdminPage.tsx` each carry their own copies of `#d4a017` and `#4a7c59`.
- **Suggested fix**: Create `frontend/src/lib/colors.ts` exporting:
  ```ts
  export const SEV_COLORS = {
    critical: "#c8391a",   // --red
    high:     "#e04020",   // --red-bright
    medium:   "#d4a017",   // --severity-warn
    low:      "#4a7c59",   // --severity-resolved
  } as const;
  ```
  Replace all four inline usages with imports from this file. The `AppDetailPage` and `AdminPage` inline styles should also switch to `var(--severity-warn)` / `var(--red)` via CSS variables since they're in JS `style={}` props (CSS vars work there).
- **Why now**: `#d4a017` is duplicated in 3 files. Any design-system color change requires hunting — one was already missed (TeamDashboardPage omits `critical` and `high` entirely).

---

### Finding 3: `ReportsPage.tsx` is a dangling sub-component with a stale deletion TODO
- **Complexity**: small
- **Estimated files**: 2
- **Public API impact**: no
- **Where**: `frontend/src/pages/ReportsPage.tsx:1-2`
- **What's wrong**: File header reads:
  ```ts
  // NOTE: This page is consumed by InsightsPage (Report sub-tab) — not routed directly.
  // TODO: delete or merge fully into InsightsPage when InsightsPage is stable.
  ```
  `InsightsPage.tsx` (46 lines) is already the stable host — it simply renders `<ReportsPage />` in its "report" tab. `ReportsPage.tsx` is not registered in any router. There is no path from "InsightsPage is not stable" to anything blocking the merge today.
- **Suggested fix**: Merge `ReportsPage.tsx`'s content directly into `InsightsPage.tsx` as a `ReportTab` internal component, or keep the file but rename it to `ReportTab.tsx` and move it to `components/` to signal it isn't a routed page. Either way: delete the TODO comment.
- **Why now**: A file marked "delete me" that stays around trains the team to ignore TODOs. It also confuses anyone adding a new route — they may wonder whether `ReportsPage` should be independently routable.

---

### Finding 4: `TriageDetailPage.tsx` is a 2248-line God component
- **Complexity**: large
- **Estimated files**: 6–9 (estimated post-split)
- **Public API impact**: no
- **Where**: `frontend/src/pages/TriageDetailPage.tsx` — 2248 lines, 30 internal functions/constants
- **What's wrong**: A single React component renders: executive summary markdown, stack-trace viewer, root-cause list, AI analysis sections, severity config table, solve workflow UI (branch picker, attempt history, PR links, approve/reject), audit log accordion, ticket creation modal trigger, false-positive / close / reopen controls. It imports 36 icons and has duplicate `SyntaxHighlighter` call sites at lines 490, 816, 1455, and 1474. No sub-components are extracted.
- **Suggested fix**: Split by UI concern into:
  - `components/triage/SummarySection.tsx` — AI markdown sections
  - `components/triage/StackTraceViewer.tsx` — stack frame renderer
  - `components/triage/SolvePanel.tsx` — solve workflow controls + attempt history
  - `components/triage/AuditLogPanel.tsx` — audit accordion
  - `components/triage/IncidentActions.tsx` — false-positive / close / reopen buttons
  - Keep `TriageDetailPage.tsx` as the data-fetching shell that composes these.
- **Why now**: The 1958-line test file (`test/pages/triageDetailPage.test.tsx`) is already the largest test file in the project and is hard to navigate. Any new solve-pipeline feature requires editing this single file end-to-end. Current size makes reviewers skip thorough code review.

---

### Finding 5: `backend/app/api/routes/triage.py` has 21 routes in 1373 lines — needs sub-router split
- **Complexity**: large
- **Estimated files**: 4–5 (estimated post-split)
- **Public API impact**: no (router prefix stays `/triage`, just internally reorganized)
- **Where**: `backend/app/api/routes/triage.py` — 1373 lines, 21 `@router` entries
- **What's wrong**: The file contains at least four distinct concern areas:
  1. **Ingestion** — `/trigger`, `/batch`, `/fetch/{app_id}` (lines 74–194)
  2. **Query / analytics** — `/dashboard`, `/analytics`, `/timeline`, `/export`, `/results`, `/result/{id}` (lines 195–570)
  3. **Ticket creation** — `/result/{id}/ticket-preview`, `/result/{id}/ticket` (lines 571–722)
  4. **Lifecycle actions** — false-positive, retriage, close, reopen, solve lifecycle (8 routes, lines 741–1373)
  
  Each group has grown independently. The corresponding test file (`tests/api/test_triage.py`) is 1498 lines and runs sequentially — slow and fragile.
- **Suggested fix**: Extract into sub-modules under `backend/app/api/routes/triage/`: `__init__.py` (mounts all), `ingestion.py`, `query.py`, `tickets.py`, `actions.py`. Update `backend/docs/components/03-api-routes.md` per CLAUDE.md requirement.
- **Why now**: The next feature touching triage (e.g. SLA breach alerts from the backlog) will add more routes. At 1373 lines, merge conflicts are already expensive.

---

### Finding 6: Major-version dep drift — `vite`, `tailwindcss`, `lucide-react`
- **Complexity**: medium
- **Estimated files**: 2–3 (package.json + config files)
- **Public API impact**: no
- **Where**: `frontend/package.json`
- **What's wrong**: Three dependencies are multiple major versions behind with known breaking changes:
  | Package | Current | Latest | Gap |
  |---|---|---|---|
  | `vite` | 6.4.1 | 8.0.10 | 2 major versions |
  | `tailwindcss` | 3.4.19 | 4.2.4 | major (new CSS-first config format) |
  | `lucide-react` | 0.460.0 | 1.11.0 | v1.0 stable (icon renames) |
  | `typescript` | 5.9.3 | 6.0.3 | major (new strict defaults) |
  
  Minor drift (`react`, `react-router-dom`, `vitest`) is within semver patch ranges and not a concern.
- **Suggested fix**: Upgrade one at a time with a passing test run between each. `lucide-react` first (smallest blast radius — icon name changes only). `vite` second (config compat shims available). `tailwindcss` last (new config format requires rewriting `tailwind.config.js`). Defer `typescript@6` until the team has bandwidth for any new strict-mode violations.
- **Why now**: `vite@8` has security patches and a new Rolldown bundler that can significantly reduce build times. Deferred major upgrades compound — each new minor feature locks in the old API surface further.
