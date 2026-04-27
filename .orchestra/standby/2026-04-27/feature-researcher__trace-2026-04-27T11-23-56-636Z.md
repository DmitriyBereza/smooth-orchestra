# Feature Ideas — 2026-04-27 (tick 5)

## Idea 1: Webhook Delivery History & Replay UI
- **User value**: TRACE has 20+ inbound webhook parsers and HMAC validation, but when a webhook fails (bad signature, malformed payload, server error), there's zero visibility. Engineers have to check server logs or guess. A delivery history page lets them see exactly what arrived, what failed, and replay it with one click.
- **Rough scope**: Medium — new DB table for webhook receipts, new API endpoints, new UI tab on AppDetailPage
- **Suggested pipeline**: development
- **Sketch**: Add a `webhook_deliveries` table (id, app_id, received_at, source_ip, headers_json, body_hash, status enum [accepted/rejected/parse_error/signature_invalid], error_message, processing_time_ms). Log every inbound webhook hit in the existing webhook handler. Add `GET /api/apps/{app_id}/webhook-deliveries` with pagination and status filter. Add a "Webhook Log" tab on AppDetailPage showing a table with timestamp, source, status badge, and expandable payload preview. Add a "Replay" button that re-submits the stored payload through the processing pipeline. Use `.tag-resolved` / `.tag-error` styling for status badges.
- **Out of scope (for the v1 of this idea)**: Outbound webhook delivery tracking, webhook signature rotation UI, automatic retry policies, payload diff between attempts.

## Idea 2: Bulk Incident Actions on Queue Page
- **User value**: IncidentQueuePage currently only supports single-incident actions. When a deploy causes 30 related errors, an engineer must click into each one individually to resolve, assign, or snooze. Bulk actions turn a 15-minute chore into a 10-second operation.
- **Rough scope**: Small — frontend multi-select state + 1-2 new batch API endpoints
- **Suggested pipeline**: development
- **Sketch**: Add checkbox selection to each row in IncidentQueuePage with a "select all on page" header checkbox. When 1+ items are selected, show a floating action bar at the bottom with buttons: "Resolve Selected", "Assign to Team...", "Snooze 24h", "Change Severity...". Add `POST /api/triage/batch-update` accepting `{ ids: string[], action: string, params: {} }`. The action bar shows count ("12 selected") and a clear-selection button. Use the existing `.btn-secondary` and `.btn-primary` patterns. Keyboard shortcut: `x` to toggle selection on focused row.
- **Out of scope (for the v1 of this idea)**: Cross-page selection, saved selection sets, bulk actions from search results, undo/rollback for batch operations.

## Idea 3: LLM Model Selector per App
- **User value**: TRACE supports OpenAI and Anthropic but the model choice is org-wide and implicit. Different apps have different cost/quality tradeoffs — a high-volume logging service might want a cheaper model, while a payment service needs the best diagnosis. Per-app model selection gives teams control over their LLM spend without sacrificing quality where it matters.
- **Rough scope**: Medium — new app-level config field, settings UI, pipeline plumbing
- **Suggested pipeline**: development
- **Sketch**: Add `llm_provider` and `llm_model` columns to the `apps` table (nullable, falls back to org default). Add a "Triage Model" section to the app settings panel on AppDetailPage with a dropdown listing available models (fetched from a new `GET /api/llm/models` endpoint that returns configured providers and their models). Show estimated cost-per-triage next to each option using the billing service's token pricing. Update the triage pipeline's LLM provider resolution to check app-level config before org-level. Add a "Model" column to the Billing costs tab so teams can see per-model spend.
- **Out of scope (for the v1 of this idea)**: A/B testing between models, model performance comparison dashboards, custom fine-tuned model support, per-triage model override.

## Idea 4: Auto-Fix Preview Panel on Triage Detail
- **User value**: The solve/patcher backend generates code fixes and can create GitHub PRs, but there's no way to preview the generated diff inside TRACE before it's pushed. Engineers must trust the AI or go check GitHub. An inline diff preview on TriageDetailPage closes the feedback loop — see the diagnosis and the fix in one place, approve or reject without context-switching.
- **Rough scope**: Medium — new UI component on TriageDetailPage, connect to existing solve API
- **Suggested pipeline**: development
- **Sketch**: After the diagnosis section on TriageDetailPage, add a collapsible "Suggested Fix" panel that appears when a solve result exists for the triage. Show a unified diff viewer (use a lightweight lib like `react-diff-viewer`) with file path headers, syntax highlighting, and line numbers. Below the diff, show two buttons: "Create PR" (calls existing solve/create-pr endpoint) and "Dismiss Fix" (marks solve as rejected). Show solve metadata: model used, confidence score, files changed count. Use the error card left-border pattern (`.sev-p3` green border for high-confidence fixes, `.sev-p1` red for low-confidence).
- **Out of scope (for the v1 of this idea)**: Inline code editing, fix regeneration with different prompts, batch fix approval, fix history/versioning.
