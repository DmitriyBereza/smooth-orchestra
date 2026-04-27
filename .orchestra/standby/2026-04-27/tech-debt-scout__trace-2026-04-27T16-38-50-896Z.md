# Tech-Debt Scan — 2026-04-27

## Summary

TRACE frontend health is improving. TS errors dropped from 17 to 11 since last scan — all remaining errors are in test files (10x TS6133 unused variables, 1x TS2339 type mismatch). The vitest/globals tsconfig fix (trace-td-20260427-005) has been applied. No TODOs/FIXMEs exist in project source code. Production code is clean with zero `@ts-ignore` directives. Two `as any` casts remain in SolveReviewPage.tsx. Dependency drift is unchanged (vite 6→8, tailwind 3→4, typescript 5→6 are the major gaps). Large file concerns persist (TriageDetailPage 2248 lines, AppDetailPage 2007 lines, triage.py 1373 lines).

## Findings

### Finding 1: Remove 10 unused variables/imports across 6 test files

- **Complexity**: small
- **Estimated files**: 6
- **Public API impact**: no
- **Where**:
  - `frontend/src/test/api.test.ts` (lines 8, 108) — unused `vi`, `afterEach`, `capturedHeaders`
  - `frontend/src/test/components/incidentCard.test.tsx` (line 197) — unused `tags`
  - `frontend/src/test/components/toast.test.tsx` (line 6) — unused `waitFor`
  - `frontend/src/test/pages/solveReviewPage.test.tsx` (lines 2, 4) — unused `waitFor`, `Routes`, `Route`
  - `frontend/src/test/pages/triageDetailPage.test.tsx` (lines 225, 245) — unused `opts`, `getMainContent`
  - `frontend/src/test/services/api.test.ts` (line 202) — `Authorization` property access on `{}` type
- **What's wrong**: 11 TypeScript errors (10x TS6133 + 1x TS2339) all caused by unused imports/variables or an untyped object. These prevent `tsc --noEmit` from passing cleanly.
- **Suggested fix**: Remove unused imports and variable declarations. For api.test.ts line 202, cast `error.config.headers` to `Record<string, string>` or add an inline type assertion. Mechanical fix, no logic changes.
- **Why now**: A clean `tsc --noEmit` is a CI gate prerequisite. These are low-risk removals that clear the remaining noise.

### Finding 2: Replace `as any` casts in SolveReviewPage.tsx with typed error access

- **Complexity**: small
- **Estimated files**: 1
- **Public API impact**: no
- **Where**: `frontend/src/pages/SolveReviewPage.tsx` (lines 380-381)
- **What's wrong**: Two `(mutation.error as any)?.response?.data?.detail` expressions bypass TypeScript's type system. The mutation error is an `AxiosError` but cast to `any` to access nested response data.
- **Suggested fix**: Import `AxiosError` from axios and cast to `AxiosError<{ detail: string }>` instead of `any`. Or extract an `getErrorMessage(error: Error)` utility since this pattern appears in mutation error handling.
- **Why now**: Only two `as any` casts in the entire production codebase — easy to eliminate before the pattern spreads.

### Note: Stale backlog item

- **trace-td-20260427-005** ("Add vitest/globals types to tsconfig.json") is already fixed — `tsconfig.json` line 21 now includes `"types": ["vitest/globals"]`. This item should be marked complete or removed from the backlog.
