# Smooth Orchestra

> Orchestrate multiple AI coding agents as a virtual software development team — running entirely on your own machine.

**Last updated:** 2026-05-26 &middot; commit `1368baa`

## What is Smooth Orchestra?

Smooth Orchestra is a local developer tool that coordinates a team of AI agents to work through software tasks end-to-end. It supports three pipeline types — **Development**, **Marketing**, and **Design** — each with its own set of specialized roles. Agents communicate exclusively through structured markdown artifacts, and the UI shows live output from every agent while letting you approve or reject pipeline stages.

It runs entirely on your machine. There is no cloud service, no hosted backend, no data sent anywhere except to the AI provider APIs (via their respective CLIs) and optionally your own Jira instance.

## Supported AI Backends

| Backend | Binary | How to install | Notes |
|---|---|---|---|
| **Claude Code CLI** | `claude` | `npm install -g @anthropic-ai/claude-code` — [docs](https://docs.anthropic.com/en/docs/claude-code) | Default backend. Must be on your shell PATH. |
| **Cursor Agent CLI** | `agent` | Install from [cursor.com](https://cursor.com). Enable the CLI: Cursor Editor → Command Palette → "Install 'cursor' command" **or** install the standalone Agent CLI. | Used when a Cursor model is selected (e.g. Auto, Composer). |

### Making CLIs available on PATH

On macOS, GUI-launched processes (like Electron) don't inherit your shell's PATH. Smooth Orchestra extends PATH at detection time to include common locations (`~/.local/bin`, `/usr/local/bin`, `/opt/homebrew/bin`), but if your binary lives elsewhere you may need to symlink it:

```bash
# Example: symlink the Cursor Agent CLI into a standard location
ln -s "$(which agent)" /usr/local/bin/agent

# Verify Claude Code CLI is reachable
which claude    # should print a path

# Verify Cursor Agent CLI is reachable
which agent     # should print a path
```

> **Tip:** Restart the Orchestra server after installing a new CLI. The detection result is cached on first check.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | v20+ | Recommend installing via [nvm](https://github.com/nvm-sh/nvm) |
| **Claude Code CLI** | latest | See [Supported AI Backends](#supported-ai-backends) |
| **Git** | any recent | Required for branch management per task |
| **OS** | macOS / Linux | Windows has not been tested |

> **Note:** `dev.sh` is a convenience launcher that sources NVM automatically. You can also just run `npm run dev` directly if Node.js is already in your PATH.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/DmitriyBereza/smooth-orchestra.git
cd smooth-orchestra

# 2. Install dependencies
npm install

# 3. Configure environment (edit .env as needed — all values are optional)
cp .env.example .env

# 4. Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser.

On first run, a default admin account is created automatically (see [Configuration](#configuration) for how to change the credentials).

## Pipelines

### Development Pipeline
A full software engineering workflow:

```
PO → Architect → Tech Lead → Developer → TL Code Review → QA → Done
```

Roles: Product Owner, Architect, Tech Lead, Developer (parallelizable), QA Engineer.

### Marketing Pipeline
Campaign and content creation:

```
PO → Researcher → Strategist → Copywriter → Creative Director → Marketing QA → Done
```

### Design Pipeline
UI/UX design with optional Canva generation:

```
PO → Researcher → UX Designer → UI Designer → [Design Executor] → Design Reviewer → Design QA → Done
```

Each pipeline has configurable stages — you can enable/disable non-required stages per task.

## Model Selection

Each agent role can run on a different model. The model picker in the task form lets you set models per-role or all at once.

| Provider | Models | Notes |
|---|---|---|
| **Claude** | Opus 4.7, Opus 4.6, Sonnet, Haiku | Via Claude Code CLI |
| **Cursor** | Auto, Composer | Via Cursor Agent CLI. "Auto" passes `--model auto` (free tier compatible). |

If no model is selected for a role, it uses the CLI's default.

## Features

- **Multi-pipeline support** — Development, Marketing, and Design pipelines with distinct agent roles
- **Per-role model selection** — Choose different AI models for each agent role
- **Cursor + Claude support** — Use Claude Code CLI, Cursor Agent CLI, or mix both in the same task
- **PO Chat** — Interactive chat with a Product Owner agent scoped to a project, with 3-day history retention
- **Standby mode** — Autonomous idle-time improvement loop that rotates through standby roles (tech debt scout, regression QA, baseline fixer, feature researcher) across enabled projects
- **Jira integration** — Two-way sync: import Jira issues as tasks or create Jira issues from Orchestra tasks, with automatic status and comment sync
- **Telegram notifications** — Get notified when tasks complete, fail, or need review
- **Mobile API** — REST endpoints for a companion mobile app with push notification support
- **Rate-limit resilience** — Automatic halt and resume when API limits are hit, fast-crash detection for transient CLI failures
- **Session history** — Browse and archive completed task sessions
- **Git branch management** — Automatic feature branch creation and merge approval per task
- **QA baseline registry** — Track QA baselines per project; standby mode auto-fixes regressions
- **Live agent output** — Stream stdout/stderr from every agent in real time

## Configuration

All configuration is done via environment variables in your `.env` file. Copy `.env.example` to get started — every variable is optional and has a sensible default.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(random, ephemeral)* | Secret used to sign JWT session tokens. If unset, a new random secret is generated on each server start — meaning existing sessions expire on restart. Set a stable value for persistent logins. |
| `AUTH_PORT` | `3333` | Port for the Express + Socket.io backend server. |
| `SEED_EMAIL` | `admin@orchestra.local` | Email for the auto-created admin account (only used when no users exist yet). |
| `SEED_PASSWORD` | `orchestra` | Password for the auto-created admin account. **Change this before sharing your machine.** |

## Security & Trust Model

Smooth Orchestra is designed as a **local-only tool**. Understanding its trust model:

- **Network**: The backend server binds to `localhost` only. It does not listen on external interfaces. No ports should be exposed to the internet.
- **Credentials stored locally**:
  - User passwords are bcrypt-hashed and stored in `.orchestra/users.json` (gitignored).
  - JWT tokens are signed with `JWT_SECRET` from your `.env` file.
  - Jira API tokens live in `.orchestra/jira.json` (gitignored).
  - Telegram bot tokens live in `.orchestra/telegram.json` (gitignored).
- **No HTTPS**: Sessions are protected by JWT but traffic is plain HTTP. This is intentional — the tool is for `localhost` use only. Do not expose it to a network without adding a reverse proxy with TLS.
- **File system access**: Smooth Orchestra reads and writes within your project directory and `.orchestra/`. AI agents run with whatever permissions your user account has — they can read and modify files in the configured project paths.
- **AI APIs**: All AI processing goes through the respective CLI tools (Claude Code CLI, Cursor Agent CLI), which use their own stored credentials — not managed by Smooth Orchestra.
- **Ephemeral JWT secret**: By default, `JWT_SECRET` is randomly generated at startup. Sessions expire when the server restarts. Set `JWT_SECRET` in `.env` for persistent sessions.

## Jira Integration (Optional)

Smooth Orchestra can sync task status and post comments to Jira issues automatically.

**Setup:**

1. Generate an Atlassian API token at: https://id.atlassian.com/manage-profile/security/api-tokens
2. Create `.orchestra/jira.json` with the following shape:

```json
{
  "siteUrl": "https://your-org.atlassian.net",
  "cloudId": "your-cloud-id",
  "projectKey": "YOUR_PROJECT_KEY",
  "email": "your-email@example.com",
  "apiToken": "your-api-token"
}
```

3. Restart the server — Jira integration activates automatically.

> **Security note:** `.orchestra/jira.json` is listed in `.gitignore` and will never be committed.

## Telegram Notifications (Optional)

Get notified on task events (completion, failure, review needed) via Telegram.

**Setup:**

1. Create a Telegram bot via [@BotFather](https://t.me/botfather) and copy the bot token.
2. Get your chat ID (send a message to your bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. In the Orchestra UI, open the Telegram settings panel and enter the bot token and chat ID.

## Mobile API

A companion iOS app for Smooth Orchestra is in development.

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/mobile/auth/login` | None | Authenticate with `{username, password}`; returns a **30-day JWT**. |
| `POST /api/mobile/devices/register` | Bearer token | Register a device for push notifications. |
| `DELETE /api/mobile/devices/:deviceId` | Bearer token | Unregister a device. |

Device registrations are stored in `.orchestra/devices.json`.

| Variable | Default | Description |
|---|---|---|
| `MOBILE_PUSH_ENABLED` | `false` | When `true`, enables push notification dispatch via the Expo Push API. |

> **Recommended**: Set a stable `JWT_SECRET` in `.env` if you use the mobile app — without it, 30-day mobile tokens expire on every server restart.

## Known Limitations

- **Single-user focus**: Designed for one developer running tasks. Concurrent multi-user workflows are not supported.
- **No HTTPS**: Plain HTTP on localhost by design. Not suitable for use over a network without a TLS-terminating reverse proxy.
- **Ephemeral JWT secret by default**: Sessions do not survive server restarts unless `JWT_SECRET` is set in `.env`.
- **macOS / Linux only**: No Windows testing has been done. May work on WSL2 but this is untested.
- **NVM assumption in dev.sh**: The `dev.sh` convenience script sources NVM from `$HOME/.nvm`. If you manage Node.js differently, run `npm run dev` directly.

## License

MIT — see [LICENSE](./LICENSE) for details.
