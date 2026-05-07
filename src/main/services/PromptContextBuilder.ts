import { ManualQaConfig, PrConfig, ProjectRecord } from '../types/project';

/**
 * Substitute {branch} / {taskId} / {title} placeholders in a string.
 */
export function substitutePlaceholders(
  input: string,
  values: { branch?: string; taskId?: string; title?: string },
): string {
  return input
    .replaceAll('{branch}', values.branch ?? '')
    .replaceAll('{taskId}', values.taskId ?? '')
    .replaceAll('{title}', values.title ?? '');
}

/**
 * Build the markdown block injected into the QA prompt's
 * `{MANUAL_QA_CONTEXT}` placeholder.
 *
 * Returns an empty string when manual QA is disabled / unconfigured —
 * so the existing automated-only QA flow is preserved by default.
 */
export function buildManualQaContext(
  config: ManualQaConfig | undefined,
  values: { branch?: string; taskId?: string; title?: string },
): string {
  if (!config || config.mode === 'off') return '';

  const lines: string[] = [
    '## Manual Verification (REQUIRED — run after the build check, before writing qa-report.md)',
    '',
    'Tests passing and a clean build are not enough — you must walk the feature as a real user would.',
    'Use the available browser MCP tools to navigate, click, fill forms, and capture evidence.',
    '',
    `**Manual QA mode**: \`${config.mode}\``,
  ];

  if (config.mode === 'local' || config.mode === 'both') {
    lines.push(
      '',
      '### Local preview (Claude_Preview MCP)',
      `- Start the dev server with \`mcp__Claude_Preview__preview_start\` (cmd: \`${config.previewCommand ?? 'npm run dev'}\`${config.previewPort ? `, port: ${config.previewPort}` : ''}).`,
      '- Use `preview_click`, `preview_fill`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`, `preview_network` to walk acceptance criteria.',
      '- Stop the server with `preview_stop` when done.',
    );
  }

  if (config.mode === 'remote' || config.mode === 'both') {
    const urls = config.urls ?? {};
    const resolved = Object.entries(urls).map(([label, raw]) => {
      const url = substitutePlaceholders(raw, values);
      return { label, url, raw };
    });

    lines.push(
      '',
      '### Remote preview (Claude_in_Chrome MCP)',
      '- Use `mcp__Claude_in_Chrome__navigate` to open the relevant URL, then `read_page`, `find`, `left_click`, `form_input`, `read_console_messages`, `read_network_requests` to walk acceptance criteria.',
    );

    if (resolved.length > 0) {
      lines.push('', '**Configured URLs (already substituted)**:');
      for (const { label, url } of resolved) {
        lines.push(`- \`${label}\`: ${url}`);
      }
      const statusEntry = resolved.find(({ label }) => /status/i.test(label));
      if (statusEntry) {
        lines.push(
          '',
          `**Deploy gate**: before clicking the preview, open \`${statusEntry.label}\` (${statusEntry.url}) and confirm the deploy is healthy. If still building, wait briefly and retry (bounded — give up after a few minutes and report it).`,
        );
      }
    } else {
      lines.push('', '_No URLs configured — ask the user to add at least one URL in project settings, or fall back to local mode if available._');
    }
  }

  lines.push(
    '',
    '### Evidence to capture in qa-report.md',
    'For each acceptance criterion, embed:',
    '- The URL you opened (after substitution)',
    '- A screenshot of the success state (and any failure state)',
    '- Console errors (if any) — paste the relevant lines from `console_logs` / `read_console_messages`',
    '- Network failures (if any) — paste the relevant entries from `network` / `read_network_requests`',
    '',
    'If manual verification cannot proceed because **MCP tools are unavailable** (`mcp__Claude_Preview` / `mcp__Claude_in_Chrome` not loaded in your environment), **skip** the manual section — record `Mode: skipped (MCP unavailable)` in the Manual Verification block of `qa-report.md` — and you may still issue `APPROVED` if all automated tests pass and the build is clean.',
    '',
    'If manual verification cannot proceed due to an **actual failure** (deploy unhealthy, preview server crash, app errors on load), set the verdict to **FAIL** with a clear explanation.',
    '',
  );

  return lines.join('\n');
}

/**
 * Build the markdown block injected into the developer prompt's
 * `{PR_CONFIG_CONTEXT}` placeholder.
 *
 * Returns an empty string when auto-PR is disabled — the developer keeps
 * today's commit-only behavior.
 */
export function buildPrConfigContext(
  config: PrConfig | undefined,
  values: { branch?: string; taskId?: string; title?: string },
): string {
  if (!config?.enabled || !config.baseBranch) return '';

  const title = config.titleTemplate
    ? substitutePlaceholders(config.titleTemplate, values)
    : `${values.taskId ?? ''}: ${values.title ?? ''}`.trim().replace(/^:\s*/, '');
  const body = config.bodyTemplate
    ? substitutePlaceholders(config.bodyTemplate, values)
    : `Smooth Orchestra task ${values.taskId ?? ''}`;

  return [
    '## Auto-PR (REQUIRED for the primary project)',
    '',
    `After committing your work, push the branch and open a PR against \`${config.baseBranch}\` so the deploy pipeline (Vercel/Coolify/etc.) builds a preview that QA can click through.`,
    '',
    'Steps:',
    '1. `git push -u origin {branch}`  (replace `{branch}` with your actual branch name)',
    `2. \`gh pr create --base ${config.baseBranch} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\``,
    '3. Capture the resulting PR URL from `gh pr create` output.',
    '',
    '**Stamp the PR URL into `dev-notes.md`** under a top-level `## PR` section (e.g. `https://github.com/owner/repo/pull/123`). QA reads this to find the deployed preview.',
    '',
    'If `gh` fails (auth, missing repo, etc.), still push the branch and document the failure — do NOT skip the push.',
    '',
  ].join('\n');
}

/**
 * Build a `**Base branch**: <value>` line for injection into project context.
 *
 * Returns a non-empty string only when baseBranch is a non-empty string,
 * so callers can safely push/ignore the result without extra guards.
 */
export function buildBaseBranchContext(baseBranch: string | undefined): string {
  if (!baseBranch) return '';
  return `**Base branch**: ${baseBranch}`;
}

/**
 * Build the markdown block injected at {QA_BASELINE_CONTEXT} in the QA prompt.
 *
 * Instructs the QA agent to baseline test/build failures against the configured
 * target branch before deciding to reject. Without this, the agent rejects for
 * pre-existing failures that were never introduced by the current PR.
 *
 * Returns an empty string when baseBranch is not configured (agent falls back
 * to the default behavior of rejecting any failure).
 */
export function buildQaBaselineContext(
  baseBranch: string | undefined,
  registryPath?: string,
): string {
  if (!baseBranch) return '';

  const registryLines = registryPath
    ? [
        '### Persistent baseline registry',
        `Pre-existing failures are tracked at \`${registryPath}\` so the standby \`baseline-fixer\` role can pick them up later, decide if the test or the code is wrong, and auto-merge a fix.`,
        '',
        'When you confirm a failure is pre-existing on the base branch:',
        '1. Read the registry file (it\'s a JSON array; create it as `[]` if missing).',
        '2. Look for an entry with the same `testName` (or near-match `failureSignature`).',
        '   - If found and `status` is `known` or `fixing`: update its `lastSeen` to now.',
        '   - If found and `status` is `fixed` but it\'s failing again: set `status` back to `known`, update `lastSeen`, append a note that it regressed.',
        '   - If not found: append a new entry with a UUID `id`, `status: "known"`, `firstSeen` and `lastSeen` set to now.',
        '3. Write the file back as a pretty-printed JSON array. Each entry shape:',
        '   ```json',
        '   {',
        '     "id": "<uuid>",',
        '     "testName": "<file path::test name, or build step>",',
        '     "failureSignature": "<short snippet from the assertion / error>",',
        '     "location": "<best guess at the file at fault>",',
        '     "status": "known",',
        '     "firstSeen": "<ISO>",',
        '     "lastSeen": "<ISO>",',
        '     "note": "<optional free-form context>"',
        '   }',
        '   ```',
        '4. Mention in `qa-report.md` which registry entries you touched (id + testName).',
        '',
      ]
    : [];

  return [
    '## Pre-existing Failure Baseline',
    '',
    `This project's target branch is \`${baseBranch}\` — **not** \`main\`. Before rejecting for a test failure or build error, you must confirm it was introduced by this PR and does not already exist on \`${baseBranch}\`.`,
    '',
    '### How to baseline a failure',
    '1. Note which test(s) / build step failed on the feature branch.',
    `2. Run: \`git stash push -m "qa-baseline-stash" && git checkout ${baseBranch} && git pull --ff-only origin ${baseBranch}\``,
    '3. Re-run the exact same failing command on the base branch.',
    `4. Restore: \`git checkout - && git stash pop\``,
    '',
    '### Decision rule',
    `- **Fails on BOTH branches** → pre-existing on \`${baseBranch}\`. Record it as *"pre-existing failure on base branch — not introduced by this PR"* and do **not** reject for it.`,
    '- **Fails on feature branch only** → regression introduced by this PR. Set verdict to **FAIL / REJECTED**.',
    '- Apply the same check to build failures before rejecting.',
    '',
    ...registryLines,
  ].join('\n');
}

/**
 * Convenience: build all per-project prompt contexts from a project record.
 */
export function buildProjectPromptContexts(
  project: ProjectRecord | undefined,
  values: { branch?: string; taskId?: string; title?: string; qaBaselineRegistryPath?: string },
): { manualQaContext: string; prContext: string; qaBaselineContext: string } {
  return {
    manualQaContext: buildManualQaContext(project?.manualQa, values),
    prContext: buildPrConfigContext(project?.pr, values),
    qaBaselineContext: buildQaBaselineContext(project?.pr?.baseBranch, values.qaBaselineRegistryPath),
  };
}
