/**
 * Per-project configuration for manual click-through QA.
 * - mode: where the QA agent should walk the feature.
 *   - 'remote' uses the URLs map (deployed previews on Vercel/Coolify/TRACE/etc.)
 *   - 'local' uses the previewCommand to start a local dev server
 *   - 'both' tells the agent to prefer remote if a URL is configured, falling back to local
 *   - 'off' disables manual click-through entirely (today's behavior)
 *
 * URL values may include {branch} and {taskId} placeholders, substituted at
 * spawn time from session state.
 */
export interface ManualQaConfig {
  mode: 'remote' | 'local' | 'both' | 'off';
  previewCommand?: string;        // e.g. "npm run dev"
  previewPort?: number;           // e.g. 5173
  /** Labeled URLs the QA agent should know about (key is a short label). */
  urls?: Record<string, string>;
}

/**
 * Per-project configuration for automatically opening a PR after the developer
 * commits. When enabled, developer pushes the branch and runs `gh pr create
 * --base {baseBranch}` so QA can validate the deployed preview.
 */
export interface PrConfig {
  enabled: boolean;
  baseBranch?: string;            // required when enabled, e.g. "qa"
  titleTemplate?: string;         // optional, supports {taskId} {title} {branch}
  bodyTemplate?: string;          // optional, supports {taskId} {title} {branch}
}

/**
 * Per-project flag for the standby (idle improvement) loop.
 * When `enabled: true`, the StandbyScheduler will include this project in its
 * round-robin rotation: each tick picks a (role, project) pair from the set
 * of enabled projects and the three rotating roles.
 *
 * When absent or `enabled: false`, the project is skipped — standby ignores
 * it. Default for new projects is `false` so that toggling standby ON doesn't
 * suddenly start scanning every registered project.
 */
export interface StandbyProjectConfig {
  enabled: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string; // absolute local path to the codebase
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** Optional — manual QA config (defaults to 'off' when absent). */
  manualQa?: ManualQaConfig;
  /** Optional — auto-PR config (defaults to disabled when absent). */
  pr?: PrConfig;
  /** Optional — standby loop opt-in (defaults to disabled when absent). */
  standby?: StandbyProjectConfig;
}
