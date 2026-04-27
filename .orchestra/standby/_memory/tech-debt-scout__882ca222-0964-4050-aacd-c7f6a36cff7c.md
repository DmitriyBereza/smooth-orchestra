# Tech-Debt Scout Memory — TRACE

## Last scan: 2026-04-27T16:38

## Findings (active in backlog as drafts)
- trace-td-20260426-002: Decompose TriageDetailPage.tsx 2248 lines (medium)
- trace-td-20260426-003: Split triage.py routes 1373 lines (medium)
- trace-td-20260426-005: Upgrade vite 6→8 + plugin-react 4→6 (medium)
- trace-td-20260427-006: Remove 10 unused vars in 6 test files — 11 TS errors (small, 6 files)
- trace-td-20260427-007: Replace 2 `as any` casts in SolveReviewPage.tsx (small, 1 file)

## Standing concerns
- Major dep drift: vite (6→8), lucide-react (0.460→1.11), jsdom (25→29), tailwindcss (3→4), typescript (5→6), react-markdown (9→10)
- Production build clean; 11 TS errors all in test files (down from 17)
- Large pages: TriageDetail (2248), AppDetail (2007), Settings (1340), Admin (1339)
- Backend large: triage.py (1373), admin.py (889), retriever.py (883)
- api.ts is 1043 lines / 120 exports — modularization candidate (medium)
- Zero TODOs/FIXMEs in project source. Zero @ts-ignore. Only 2 `as any` in prod.

## Auto-executed
- 2026-04-26: trace-td-20260426-004 Rename ReportsPage→ReportTab → TASK-9E1DDC4C
- 2026-04-27: trace-td-20260427-001 Replace empty catch blocks → TASK-629C016D

## Promoted
- trace-td-20260427-002 Remove fs guard tests → TASK-E11CE1D7
- trace-td-20260427-003 Fix StackFrame type mismatch → TASK-956BC01D
- trace-td-20260427-004 Remove dead exports → TASK-8AA4A552

## Resolved (no longer relevant)
- trace-td-20260427-005 vitest/globals types — already applied in tsconfig.json

## Dismissed: (none)
- 2026-04-27T16:43:20.314Z auto-executed: trace-td-20260427-007 Replace 2 'as any' casts in SolveReviewPage.tsx with AxiosError type → TASK-000A2265
