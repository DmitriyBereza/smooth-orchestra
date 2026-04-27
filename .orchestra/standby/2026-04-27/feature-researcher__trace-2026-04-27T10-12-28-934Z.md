# Feature Ideas — 2026-04-27

## Idea 1: Incident Comments & Activity Feed
- **User value**: TRACE has zero collaboration features on incidents. When an on-call engineer is triaging an error, there's no way to leave notes, tag a teammate, or record what was tried. This forces teams to context-switch to Slack/Jira to discuss errors that TRACE already has full context on. Adding comments turns TRACE from a read-only dashboard into an active incident workspace.
- **Rough scope**: Medium — new DB model, CRUD API, real-time UI component
- **Suggested pipeline**: development
- **Sketch**: Add a `comments` table (id, triage_result_id, user_id, body text, created_at). Add CRUD endpoints under `/api/triage/{id}/comments`. On TriageDetailPage, render a collapsible activity feed below the diagnosis section showing both system events (status changes, assignments, solve attempts) and user comments in chronological order. Include a text input with submit button at the bottom. Use IBM Plex Mono for comment body per brand rules. Show commenter name + timestamp in metadata style (11px, `var(--mono-2)`).
- **Out of scope (for the v1 of this idea)**: @mentions with notifications, rich text/markdown rendering, file attachments, comment reactions/threading.

## Idea 2: Audit Log Viewer in Admin Panel
- **User value**: The backend already has a complete audit logging service (`audit.py`) that records every user action with CSV export — but there's no frontend page to view it. Admins currently have no visibility into who changed what without hitting the API directly. This is a compliance gap for enterprise teams who need audit trails.
- **Rough scope**: Small — frontend-only, API already exists
- **Suggested pipeline**: development
- **Sketch**: Add an "Audit Log" tab to AdminPage. Fetch from the existing audit API endpoint with pagination. Render a table with columns: timestamp, user, action, entity type, entity ID. Add filter chips for action type (create/update/delete) and entity type (app/team/rule/triage). Add a "Download CSV" button that hits the existing CSV export endpoint. Use `.tag` styling for action type badges (create=green, update=amber, delete=red). Table rows use IBM Plex Mono 12px per brand rules.
- **Out of scope (for the v1 of this idea)**: Date range picker, user-level filtering, clickable entity links, real-time streaming of new entries.

## Idea 3: Team Error Heatmap on Team Dashboard
- **User value**: TeamDashboardPage currently shows a basic leaderboard (resolution rates, MTTR) but gives no insight into *when* errors hit each team or which error categories dominate. A heatmap showing error volume by team × time-of-day would instantly reveal patterns like "Team Backend gets slammed every Monday 9am after weekend batch jobs" — actionable for staffing and on-call scheduling.
- **Rough scope**: Medium — new analytics endpoint, heatmap visualization component
- **Suggested pipeline**: development
- **Sketch**: Add `GET /api/analytics/team-heatmap?window=7d` that returns a matrix of error counts bucketed by team × hour-of-day (or day-of-week). On TeamDashboardPage, add a "Heatmap" section below the existing leaderboard. Render a grid using CSS grid or a lightweight chart lib — cells colored from `var(--surface-2)` (zero) through `var(--red-dim)` to `var(--red)` (peak). Hovering a cell shows a tooltip with exact count, team name, and time bucket. Clicking drills to the incident queue filtered by that team + time range.
- **Out of scope (for the v1 of this idea)**: Per-member breakdown within a team, heatmap by error category, configurable bucket sizes, export/share.

## Idea 4: Scheduled Email Reports
- **User value**: The ReportTab already generates stakeholder-ready summaries with CSV/JSON export, but someone has to manually open TRACE, generate the report, and share it. Enterprise teams need automated weekly/monthly reports delivered to stakeholders who don't log into TRACE — engineering managers, VPs, compliance officers.
- **Rough scope**: Medium — new schedule model, Celery Beat task, email template
- **Suggested pipeline**: development
- **Sketch**: Add a `report_schedules` table (id, org_id, created_by, cron_expression, recipients JSON array of emails, report_type, filters JSON, enabled boolean). Add CRUD endpoints under `/api/reports/schedules`. Register a Celery Beat periodic task that checks for due schedules every 15 minutes, generates the report using existing report logic, and sends via the existing email service. Add a "Schedule" button on ReportTab that opens a modal with frequency selector (daily/weekly/monthly), recipient list input, and filter presets. Use the existing `email_templates.py` infrastructure for a clean `report_delivery` template.
- **Out of scope (for the v1 of this idea)**: PDF rendering, Slack delivery channel, report template customization, multi-org scheduling.
