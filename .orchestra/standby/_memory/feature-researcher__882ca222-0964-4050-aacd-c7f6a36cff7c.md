# Feature Researcher Memory — TRACE (882ca222-0964-4050-aacd-c7f6a36cff7c)

## Last run: 2026-04-27 (tick 5)

## User actions
- PROMOTED: Digest Settings Page (trace-fr-20260426-001) → TASK-7E87D6CA
- PROMOTED: Audit Log Viewer in Admin Panel (trace-fr-20260427-006) → TASK-0664E7BE
- PROMOTED: Error Regression Banners on Dashboard (trace-fr-20260427-004) → TASK-250E256A
- DISMISSED: Auto-Merge for High-Confidence Solve Patches (trace-fr-20260426-004)

## Draft proposals still in backlog (don't re-propose)
- SLA Targets and Breach Alerts (tick 1)
- Slack Interactive Triage Actions (tick 1)
- Manual Error Group Management (tick 2)
- Saved Filters and Custom Views on Incident Queue (tick 2)
- Full-Text Search on Error Messages and Stack Traces (tick 2)
- Smart Notification Batching (tick 3)
- Incident Correlation Timeline (tick 3)
- Runbook Links per Error Type (tick 3)
- Incident Comments & Activity Feed (tick 4)
- Team Error Heatmap on Team Dashboard (tick 4)
- Scheduled Email Reports (tick 4)
- Webhook Delivery History & Replay UI (tick 5)
- Bulk Incident Actions on Queue Page (tick 5)
- LLM Model Selector per App (tick 5)
- Auto-Fix Preview Panel on Triage Detail (tick 5)

## Project observations
- User promoted 3 items so far: digest settings, audit log viewer, regression banners — pattern: operational visibility features.
- solve/patcher.py backend exists but zero frontend; auto-fix preview is natural next step.
- 20+ webhook parsers with no delivery logging — debugging gap.
- IncidentQueuePage has no multi-select or bulk actions.
- 19 proposals now in backlog. Next tick: consider error budget tracking, public status page, on-call rotation, or custom triage prompt tuning.
