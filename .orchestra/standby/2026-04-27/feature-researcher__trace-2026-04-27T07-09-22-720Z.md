# Feature Ideas — 2026-04-27

## Idea 1: Smart Notification Batching to Reduce Alert Fatigue
- **User value**: Enterprise teams using TRACE get flooded when a deploy causes 50+ errors simultaneously. Each triggers an independent notification per rule, burying the signal in noise. Batching related alerts into a single digest-style notification keeps on-call engineers focused.
- **Rough scope**: Medium — new batching logic in notification worker + config UI
- **Suggested pipeline**: development
- **Sketch**: Add a configurable batching window (e.g. 60s default) to notification rules. When multiple triage results match the same rule within the window, collapse them into a single notification with a count and top-3 error summary. Store batch state in Redis with TTL. Add a "Batching" toggle + window-size input to the notification rule editor in SettingsModal. Slack/email templates get a "grouped" variant showing error count, severity breakdown, and a link to filtered incident queue.
- **Out of scope (for the v1 of this idea)**: Cross-rule batching, ML-based grouping, custom batch templates per channel.

## Idea 2: Incident Correlation Timeline (Link Related Errors by Deploy/Root Cause)
- **User value**: When a bad deploy lands, TRACE detects spikes via `patterns.py` but each error is treated independently. Engineers waste time triaging 10 errors that share one root cause. A correlation timeline would show "these 8 errors all appeared after deploy X" and let you resolve them as a group.
- **Rough scope**: Large — new correlation service, deploy event ingestion, frontend timeline view
- **Suggested pipeline**: development
- **Sketch**: Ingest deploy markers via a new `/api/webhooks/deploy` endpoint (timestamp, commit SHA, app_id). Add a `CorrelationService` that runs after spike detection: when a spike is found, query all new error groups created within the spike window and tag them with a shared `correlation_id`. Add a "Correlated Incidents" panel on TriageDetailPage showing sibling errors from the same spike. Add a dedicated timeline view (or tab on InsightsPage) that plots deploy events against error volume, with clickable clusters.
- **Out of scope (for the v1 of this idea)**: Automatic root-cause ranking across correlated errors, rollback suggestions, CI/CD integration beyond webhook.

## Idea 3: Runbook Links per Error Type
- **User value**: Many enterprise teams have internal runbooks for known error patterns (e.g. "OOMKilled → check memory limits in k8s"). TRACE diagnoses errors with LLMs but doesn't connect to existing organizational knowledge in runbook form. Linking runbooks turns TRACE from "here's what's wrong" into "here's what's wrong and here's your team's playbook to fix it."
- **Rough scope**: Small — new model field, CRUD API, UI on TriageDetailPage
- **Sketch**: Add a `runbooks` table (id, org_id, error_type_pattern regex, title, url, created_by). Add CRUD endpoints under `/api/runbooks`. On TriageDetailPage, after the diagnosis section, show matched runbook links by matching the triage result's `error_type` against runbook patterns. Add a "Runbooks" section in SettingsModal for managing entries. Optionally auto-suggest runbook creation when the same error type recurs 5+ times without one.
- **Out of scope (for the v1 of this idea)**: Inline runbook rendering, runbook versioning, integration with Confluence/Notion APIs.

## Idea 4: Error Regression Banners on Dashboard
- **User value**: The backend already detects spikes and regressions in `patterns.py` (30-day baseline comparison), but this data isn't surfaced prominently in the UI. Engineers have to notice trends themselves. A banner system would proactively alert users the moment they open the dashboard: "3 error regressions detected in the last 24h."
- **Rough scope**: Small — new API endpoint to fetch active patterns, banner component on DashboardPage
- **Sketch**: Add `GET /api/analytics/active-patterns` that returns current spikes/regressions from `PatternDetector` with severity and affected app. Create a `RegressionBanner` component on DashboardPage that fetches active patterns on mount and renders dismissible alert cards at the top — red for spikes, amber for regressions. Each banner links to the filtered incident queue for that app + time range. Dismissed banners stored in localStorage with pattern ID + timestamp.
- **Out of scope (for the v1 of this idea)**: Push notifications for new regressions, pattern history/archive, configurable thresholds per app.
