# Smooth Orchestra — Architecture & Design

**Last updated:** 2026-05-26 &middot; commit `1368baa`

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Vite/React)                  │
│  TaskBoard · AgentPanel · Pipeline · PO Chat · Standby  │
└──────────────────────┬──────────────────────────────────┘
                       │ Socket.io (JWT auth)
┌──────────────────────▼──────────────────────────────────┐
│                  Express + Socket.io Server              │
│                     (Node.js, localhost)                 │
├─────────────────────────────────────────────────────────┤
│  SocketServer ─── AuthService ─── EventBus (singleton)  │
│       │                              │                  │
│       ▼                              ▼                  │
│  SessionManager ◄──────────── AgentPool                 │
│  (state machine)              (process lifecycle)       │
│       │                              │                  │
│       ├── ArtifactManager            ├── AgentProcess   │
│       ├── GitManager                 │   (Claude CLI)   │
│       ├── SubtaskParser              └── CursorDetector │
│       └── PromptContextBuilder           (agent CLI)    │
│                                                         │
│  StandbyScheduler  PoChatService  JiraService           │
│  TelegramNotifier  ProjectStore   UserStore             │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌───────────┐     ┌──────────────┐
   │ claude CLI │     │ agent CLI    │
   │ (Claude)   │     │ (Cursor)     │
   └───────────┘     └──────────────┘
```

## Core Concepts

### EventBus

A typed `EventEmitter` singleton (`src/main/services/EventBus.ts`) that is the central nervous system. All inter-service communication flows through it — no service holds a direct reference to another service's internals. Events are strongly typed via `OrchestraEventMap`.

### SessionManager (State Machine)

`src/main/services/SessionManager.ts` (~1500 lines) is the pipeline orchestrator. It manages one active task at a time (MVP constraint).

Responsibilities:
- Owns the `SessionState` (current stage, assigned agents, models, artifacts)
- Advances through pipeline stages by spawning agents and listening for exit events
- Handles review gates (approve/reject) and loops back on rejection
- Manages max-turns continuation (up to 3 auto-resumes per stage)
- Detects rate limits and schedules automatic retry
- Persists session state to `.orchestra/session.json` and history to `.orchestra/history.json`

Stage flow for every pipeline:
```
PO → [pipeline-specific stages] → awaiting_user_review → [merge approval] → done
```

### Pipeline Registry

Pipelines are self-registering modules in `src/main/pipelines/`. Each pipeline file calls `registerPipeline()` on import, which adds its config to a central `Map<PipelineType, PipelineTypeConfig>`.

A `PipelineTypeConfig` defines:
- `allStages` / `defaultPipeline` — available and default stage sequences
- `stageToRole` — which agent role runs each stage
- `stageArtifacts` — what each stage reads and writes
- `reviewStages` — which stages perform reviews and where to loop back on rejection
- `requiredStage` — the one stage that cannot be deselected
- `poComplexityGuide` / `storyTemplate` — domain-specific PO prompt content
- `rolePrompts` — role-specific system prompt overrides

The `SharedPipelineConfig` in `src/shared/pipeline-configs.ts` contains the subset of pipeline data needed by the frontend (stage labels, colors, model selector roles).

### AgentProcess

`src/main/services/AgentProcess.ts` wraps a single CLI child process. It handles both Claude Code CLI (`claude`) and Cursor Agent CLI (`agent`) based on the selected model:

- **Claude models** (`claude-opus-*`, `claude-sonnet-*`, `claude-haiku-*`): spawns `claude` with `--system-prompt`, `--max-turns 200`, `--dangerously-skip-permissions`
- **Cursor models** (`cursor-auto`, `composer-*`): spawns `agent` with `--force`, `--output-format stream-json`. For `cursor-auto`, passes `--model auto` (free-tier compatible).

Both backends stream JSON to stdout. AgentProcess parses lines for:
- Session IDs (for resume capability)
- Token usage counters
- Rate limit / overload errors (triggers auto-retry)
- Max-turns events (triggers auto-continuation)
- Fast-crash detection (exit within 30s = transient failure, not a real error)

### AgentPool

`src/main/services/AgentPool.ts` manages all active AgentProcess instances. Keyed by unique agent ID with a secondary role index. For non-developer roles, creating a new agent kills the existing one (one-at-a-time). Developer agents with a `subtaskId` can run concurrently (parallel subtask execution).

### ArtifactManager

`src/main/services/ArtifactManager.ts` handles reading and writing markdown artifacts to `.orchestra/tasks/{taskId}/`. Each pipeline stage has declared reads and writes — the artifact manager builds context strings from read artifacts and persists write artifacts.

### Prompt System

Prompts live in `src/main/prompts/`. Structure:

```
prompts/
  base.ts              — shared prompt fragments
  po.ts                — Product Owner (all pipelines)
  architect.ts         — Development pipeline
  tech-lead.ts         — Development pipeline
  developer.ts         — Development pipeline
  qa.ts                — Development pipeline
  po-chat.ts           — PO Chat agent
  marketing/           — Marketing pipeline roles
  design/              — Design pipeline roles
  standby/             — Standby scheduler roles
```

`buildSystemPrompt()` and `buildTaskPrompt()` compose the final prompts by combining base fragments, pipeline-specific content, artifact context, and project context.

## Key Services

### StandbyScheduler

`src/main/services/StandbyScheduler.ts` — the autonomous idle-time improvement loop.

- Toggleable ON/OFF (default OFF)
- 1-minute tick timer; each tick spawns one standby agent with a (role, project) pair
- Round-robin across standby roles AND enabled projects
- Cross-rotation memory at `.orchestra/standby/_memory/{role}__{projectId}.md`
- Proposals stored in `.orchestra/standby/backlog.json`
- Standby roles: tech-debt-scout, regression-qa, baseline-fixer, feature-researcher

### PoChatService

`src/main/services/PoChatService.ts` — interactive chat with a PO agent scoped to a project.

- One agent per project at a time
- History persisted to `.orchestra/po-chat/{projectId}/history.json`
- Messages older than 3 days auto-pruned
- Uses `ChatAgentProcess` (simplified wrapper for conversational use)

### GitManager

`src/main/services/GitManager.ts` — handles branch creation, switching, and merge operations per task. Each task gets a `orchestra/{taskId}` branch.

### JiraService + JiraSyncListener

Two-way Jira integration:
- `JiraService` — REST client for Jira Cloud API (create issue, transition, comment, fetch)
- `JiraSyncListener` — listens to EventBus events and syncs status/comments to Jira

### TelegramNotifier

`src/main/services/TelegramNotifier.ts` — subscribes to EventBus events (task created, stage completed, task failed, review needed) and sends formatted messages via the Telegram Bot API.

### CursorDetector

`src/main/services/CursorDetector.ts` — checks whether a Cursor CLI binary (`cursor` or `agent`) is available on PATH. Results are cached; the frontend can request a refresh. Used to show/hide Cursor model options in the UI.

## Frontend Architecture

```
src/renderer/
  App.tsx                           — root with auth gate + tab layout
  hooks/useSocket.ts                — Socket.io connection + event wiring
  store/
    sessionStore.ts                 — Zustand: session state, agents, pipeline
    authStore.ts                    — Zustand: JWT token, login state
    cursorStore.ts                  — Zustand: Cursor CLI availability
    projectStore.ts                 — Zustand: project list, selection
    standbyStore.ts                 — Zustand: standby state, backlog
    poChatStore.ts                  — Zustand: PO chat messages
  components/
    TaskBoard/                      — task creation form, task cards, model picker
    AgentPanel/                     — live agent output tabs
    Pipeline/                       — visual pipeline stage indicator
    PoChat/                         — PO chat interface
    Standby/                        — standby control panel + backlog
    ProjectManager/                 — project CRUD
    Login/                          — auth form
    common/                         — shared UI components (LogViewer, etc.)
```

State is managed via Zustand stores, hydrated from Socket.io events on connect. The socket hook (`useSocket`) wires all server events to their respective stores.

## Data Flow: Task Lifecycle

```
1. User fills NewTaskForm (title, description, pipeline, models)
2. Socket emits 'command:create-task'
3. SocketServer validates (Cursor availability, Jira creation) → EventBus
4. SessionManager creates SessionState, persists, emits 'session:created'
5. SessionManager starts PO stage → AgentPool.createAgent() → AgentProcess.start()
6. AgentProcess spawns CLI child process, streams output via EventBus
7. On exit, SessionManager reads PO artifact → advances to next stage
8. Repeat (5-7) for each pipeline stage
9. At review gates, SessionManager pauses and waits for user approval
10. On final approval, GitManager merges branch → session moves to 'done'
```

## File Storage

All persistent data lives under `.orchestra/` (gitignored):

```
.orchestra/
  session.json          — current active session state
  history.json          — completed session history
  users.json            — bcrypt-hashed user credentials
  projects.json         — registered project paths and config
  devices.json          — mobile push notification device registrations
  jira.json             — Jira API credentials
  telegram.json         — Telegram bot token and chat ID
  tasks/{taskId}/       — artifacts per task (story.md, design.md, etc.)
  standby/
    backlog.json        — standby proposals
    _memory/            — per-(role, project) standby history
  po-chat/{projectId}/  — PO chat history per project
  qa-baselines/         — QA baseline snapshots per project
```

## Security Boundaries

- Server binds to `localhost` only — no external network exposure
- JWT auth on all socket connections and REST endpoints
- Passwords bcrypt-hashed at rest
- CLI agents run as the host user — full filesystem access within project paths
- No secrets managed by Orchestra (API keys stored by respective CLI tools)
- Jira/Telegram tokens stored in gitignored JSON files
