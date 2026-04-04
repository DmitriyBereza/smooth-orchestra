# Smooth Orchestra

> Orchestrate multiple Claude Code CLI agents as a virtual AI software development team — running entirely on your own machine.

## What is Smooth Orchestra?

Smooth Orchestra is a local developer tool that coordinates a team of AI agents (Product Owner, Architect, Tech Lead, Developer, QA Engineer) to work through software tasks end-to-end. Each agent is a Claude Code CLI process that reads and writes structured markdown artifacts, simulating a real engineering team — from writing user stories all the way to a QA-validated implementation.

It runs entirely on your machine. There is no cloud service, no hosted backend, no data sent anywhere except to Anthropic's API (via Claude Code CLI) and optionally your own Jira instance.

## Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | v20+ | Recommend installing via [nvm](https://github.com/nvm-sh/nvm) |
| **Claude Code CLI** | latest | `npm install -g @anthropic-ai/claude-code` — [docs](https://docs.anthropic.com/en/docs/claude-code) |
| **Git** | any recent | Required for branch management per task |
| **OS** | macOS / Linux | Windows has not been tested |

> **Note:** `dev.sh` is a convenience launcher that sources NVM automatically. You can also just run `npm run dev` directly if Node.js is already in your PATH.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/smooth-orchestra.git
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

## Configuration

All configuration is done via environment variables in your `.env` file. Copy `.env.example` to get started — every variable is optional and has a sensible default.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(random, ephemeral)* | Secret used to sign JWT session tokens. If unset, a new random secret is generated on each server start — meaning existing sessions expire on restart. Set a stable value for persistent logins. |
| `AUTH_PORT` | `3333` | Port for the Express + Socket.io backend server. |
| `SEED_EMAIL` | `admin@orchestra.local` | Email for the auto-created admin account (only used when no users exist yet). |
| `SEED_PASSWORD` | `orchestra` | Password for the auto-created admin account. **Change this before sharing your machine.** |

## How It Works

Smooth Orchestra runs a pipeline of specialized AI agents for each task you create:

```
User creates task in UI
        │
        ▼
  Product Owner  →  story.md (user story + acceptance criteria)
        │
        ▼
   Architect     →  design.md + dev-tasks.md (technical design + task breakdown)
        │
        ▼
   Tech Lead     →  review.md (design review + approval)
        │
        ▼
   Developer     →  code changes + dev-notes.md + qa-spec.md (TDD implementation)
        │
        ▼
  QA Engineer    →  qa-report.md (validation against acceptance criteria)
```

Each agent is a **Claude Code CLI process** spawned by the backend. Agents communicate exclusively through markdown files written to `.orchestra/tasks/{taskId}/`. The UI shows live output from each agent and lets you approve or reject pipeline stages.

Tasks can target one or more **projects** in your workspace. Each project gets its own git branch for the implementation.

## Security & Trust Model

Smooth Orchestra is designed as a **local-only tool**. Understanding its trust model:

- **Network**: The backend server binds to `localhost` only. It does not listen on external interfaces. No ports should be exposed to the internet.
- **Credentials stored locally**:
  - User passwords are bcrypt-hashed and stored in `.orchestra/users.json` (gitignored).
  - JWT tokens are signed with `JWT_SECRET` from your `.env` file.
  - Jira API tokens live in `.orchestra/jira.json` (gitignored — see below).
- **No HTTPS**: Sessions are protected by JWT but traffic is plain HTTP. This is intentional — the tool is for `localhost` use only. Do not expose it to a network without adding a reverse proxy with TLS.
- **File system access**: Smooth Orchestra reads and writes within your project directory and `.orchestra/`. Claude Code CLI agents run with whatever permissions your user account has — they can read and modify files in the configured project paths.
- **Claude API**: All AI processing goes through Claude Code CLI, which uses your Anthropic account credentials (stored by the Claude Code CLI itself, not by Smooth Orchestra).
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

> **Security note:** `.orchestra/jira.json` is listed in `.gitignore` and will never be committed. Keep your API token out of any files that are tracked by git.

## Known Limitations

- **Claude Code CLI required**: Smooth Orchestra is not provider-agnostic. It spawns `claude` CLI processes. Support for other AI providers is a future goal.
- **Single-user focus**: The system is designed for one developer running tasks sequentially. Concurrent multi-user workflows are not supported.
- **No HTTPS**: Plain HTTP on localhost by design. Not suitable for use over a network without a TLS-terminating reverse proxy.
- **Ephemeral JWT secret by default**: Sessions do not survive server restarts unless `JWT_SECRET` is set in `.env`.
- **macOS / Linux only**: No Windows testing has been done. The tool may work on WSL2 but this is untested.
- **NVM assumption in dev.sh**: The `dev.sh` convenience script sources NVM from `$HOME/.nvm`. If you manage Node.js differently, run `npm run dev` directly.

## License

MIT — see [LICENSE](./LICENSE) for details.
