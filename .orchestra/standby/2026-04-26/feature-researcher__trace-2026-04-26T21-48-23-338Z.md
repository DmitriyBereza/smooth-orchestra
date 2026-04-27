# Feature Ideas — 2026-04-26

## Idea 1: Digest Settings Page (Frontend)
- **User value**: The weekly digest backend is fully implemented (service, routes, opt-out model, HTML renderer, Celery beat schedule) but there is zero frontend UI for it. Users can't opt out, preview, or configure delivery without hitting the API directly. This ships a complete feature that's currently stranded.
- **Rough scope**: Small
- **Suggested pipeline**: development
- **Sketch**: Add a "Digest" tab to the existing SettingsPage. It needs three elements: (1) an opt-in/out toggle wired to `GET /api/digest/status` + `POST /api/digest/opt-out` / `DELETE /api/digest/opt-out`; (2) a "Preview this week's digest" button that calls `POST /api/digest/preview` and renders the returned HTML in a fullscreen modal; (3) a read-only note showing the delivery schedule (every Monday 09:00 UTC, sourced from Celery beat config). No backend changes needed — all routes and logic already exist.
- **Out of scope (for the v1 of this idea)**: Custom delivery day/time per user, per-app digest filters, digest send history log.

---

## Idea 2: SLA Targets and Breach Alerts
- **User value**: TRACE already tracks MTTR, severity, and timestamps — but there's no way to define what "good" looks like. Enterprise teams operate against SLAs (P0: 15 min, P1: 1 hr, P2: 4 hr). Without targets, the analytics are descriptive, not actionable. SLA breach alerts turn TRACE from a reporting tool into a compliance tool.
- **Rough scope**: Medium
- **Suggested pipeline**: development
- **Sketch**: Add a `SLAConfig` model on `Organization` (JSON column: `{"critical": 900, "high": 3600, "medium": 14400}` in seconds). Expose it in `GET/PUT /api/org/settings`. In the triage history service, compute `sla_breached: bool` on each result by comparing `resolved_at - created_at` against the threshold. Add a `sla_breach` trigger type to `NotificationRuleCreate` (the `SeverityLevel` enum change from Session 5 is already in place — this parallels it). Add a dashboard widget to `DashboardPage.tsx` showing per-severity SLA compliance % over the last 30 days as a simple bar or gauge. Celery beat can run a periodic check for unresolved errors that have exceeded their SLA threshold and fire the notification.
- **Out of scope (for the v1 of this idea)**: SLA reporting in CSV exports, per-app SLA overrides, SLA history/trend chart, customer-facing SLA status page.

---

## Idea 3: Slack Interactive Triage Actions
- **User value**: Slack notifications are currently one-way: TRACE tells you about an error, you have to go to the TRACE UI to do anything about it. Engineers living in Slack lose the loop-closing step. Interactive buttons in the Slack message — [Assign to me] [Acknowledge] [False positive] — let an on-call engineer act without context-switching.
- **Rough scope**: Medium
- **Suggested pipeline**: development
- **Sketch**: Upgrade `notifications/channels/slack.py` to emit Block Kit `actions` blocks with three buttons (assign, acknowledge, false-positive) carrying the `triage_result_id` in the `action_id`. Add a new route `POST /api/webhooks/slack/actions` that receives Slack's interaction payload, verifies the signing secret, and dispatches the appropriate status update (calls existing triage route logic: assign, mark false positive, etc.). After processing, use Slack's `response_url` to update the original message in-place, replacing buttons with a status stamp ("Acknowledged by @alice — 14:23"). The integration config in `AppIntegration` already stores the Slack credentials; add a `slack_signing_secret` field.
- **Out of scope (for the v1 of this idea)**: Slack modal for adding notes, slash-command triage search, multi-workspace support, Teams/Discord parity.

---

## Idea 4: Auto-Merge for High-Confidence Solve Patches
- **User value**: The solve pipeline creates GitHub PRs for both Tier-1 (deterministic patcher) and Tier-2 (Claude agent) fixes, but a human must review and merge every one. For Tier-1 patches on well-tested repos, confidence is high and the review step is friction. An auto-merge threshold closes the loop: zero-touch remediation for classes of errors TRACE already knows how to fix.
- **Rough scope**: Medium
- **Suggested pipeline**: development
- **Sketch**: Add `auto_merge_threshold: float | None` (0.0–1.0) to the `App` model, surfaced in app settings UI. In `github_pr.py`, after `create_pull_request` succeeds, if the app has a threshold configured and the solve's `confidence_score` meets it, call GitHub's enable-auto-merge API (`PUT /repos/{owner}/{repo}/pulls/{number}/merge` with `merge_method: squash`) — only after confirming required CI checks are configured on the branch protection rule. Store the auto-merge decision and outcome in the triage result for audit. Default `auto_merge_threshold = null` (opt-in only). Add a `solve_auto_merged` notification trigger type.
- **Out of scope (for the v1 of this idea)**: GitLab / Bitbucket auto-merge, revert-on-failure monitoring, confidence score recalibration from merge outcomes.
