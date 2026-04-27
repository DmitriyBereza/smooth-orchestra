# Feature Ideas — 2026-04-26

## Idea 1: Manual Error Group Management (Merge / Split / Ignore)
- **User value**: TRACE fingerprints errors algorithmically (error type + top stack frames), but real-world dedup is messy — different exception types from the same root cause get separate groups, or one fingerprint captures unrelated errors. Without merge/split controls, users can't correct grouping mistakes, leading to noise and missed patterns.
- **Rough scope**: Medium
- **Suggested pipeline**: development
- **Sketch**: Add a `FingerGroupOverride` model linking two fingerprints with an action (`merge_into`, `split_from`, `ignore`). Expose `POST /api/history/groups/merge` (accepts source + target fingerprint IDs) and `POST /api/history/groups/split` (accepts a fingerprint ID + filter criteria for which occurrences to extract). On the IncidentQueuePage, add multi-select checkboxes with a "Merge selected" bulk action button. On TriageDetailPage's History tab, add a "Split group" option that lets users select specific occurrences to break out. Overrides are applied during the fingerprint lookup step in `history/manager.py` so they persist across future ingestion. Audit-log every override action.
- **Out of scope (for the v1 of this idea)**: ML-suggested merges, automatic split recommendations, undo/revert for merges, cross-app group management.

## Idea 2: Saved Filters and Custom Views on Incident Queue
- **User value**: IncidentQueuePage currently supports ephemeral severity and app filters that reset on navigation. Engineers who repeatedly check the same slice ("my team's P0/P1 errors in the payments service") waste clicks every session. Saved views let users bookmark their working context and share it with teammates.
- **Rough scope**: Small
- **Suggested pipeline**: development
- **Sketch**: Add a `SavedView` model (user_id, org_id, name, is_shared, filter_json containing severity, app_id, sort_by, sort_dir, and future fields like team_id or text query). Expose CRUD at `GET/POST/PUT/DELETE /api/views`. On IncidentQueuePage, add a "Views" dropdown left of the existing filters. Selecting a saved view applies its filter_json to the current query params. A "Save current view" button captures the active filter state. Shared views appear for all org members; personal views are private. Store last-used view ID in localStorage so the page reopens where the user left off.
- **Out of scope (for the v1 of this idea)**: View-level notification rules, real-time subscriber count, admin-pinned default views, complex query builder (AND/OR logic).

## Idea 3: Full-Text Search Across Error Messages and Stack Traces
- **User value**: The only way to find a specific error today is browsing the incident queue with severity/app filters. If an engineer knows the exception message ("connection refused to redis-primary:6379") or a class name deep in a stack trace, there's no way to search for it. This is table-stakes for any error management tool at scale.
- **Rough scope**: Medium
- **Suggested pipeline**: development
- **Sketch**: Add a PostgreSQL GIN index on `triage_results.error_log` using `to_tsvector('english', error_log)`. Create a `POST /api/triage/search` endpoint accepting a `query` string (passed through `plainto_tsquery`) plus the existing filters (severity, app_id, date range). Return ranked results with `ts_headline` snippets highlighting matched terms. On IncidentQueuePage, replace the page header area with a search bar (IBM Plex Mono, 12px, placeholder: "Search errors, stack traces, class names…"). Debounce input at 300ms. Results render in the same card list, with matched text highlighted in `var(--red-bright)`. pgvector is already installed (used for doc embeddings), so no new extensions needed — this uses native Postgres full-text search.
- **Out of scope (for the v1 of this idea)**: Semantic/vector search on error logs, regex search mode, search within solve patch diffs, search result pinning.
