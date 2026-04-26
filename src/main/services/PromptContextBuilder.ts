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
    'If manual verification cannot proceed (no preview, deploy unhealthy, MCP unavailable), set the verdict to FAIL with a clear explanation rather than skipping.',
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
 * Convenience: build both contexts from a project record.
 */
export function buildProjectPromptContexts(
  project: ProjectRecord | undefined,
  values: { branch?: string; taskId?: string; title?: string },
): { manualQaContext: string; prContext: string } {
  return {
    manualQaContext: buildManualQaContext(project?.manualQa, values),
    prContext: buildPrConfigContext(project?.pr, values),
  };
}
