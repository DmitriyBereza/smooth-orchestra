/**
 * Tests for PromptContextBuilder helpers.
 *
 * RED phase: These tests define expected behavior for:
 * - buildManualQaContext — MCP-unavailable guidance (skip, not FAIL)
 * - buildBaseBranchContext — base branch injection helper
 */

import { describe, it, expect } from 'vitest';
import { buildManualQaContext, buildBaseBranchContext } from '../PromptContextBuilder';

// ---------------------------------------------------------------------------
// buildManualQaContext
// ---------------------------------------------------------------------------

describe('buildManualQaContext', () => {
  it('with mode "local" includes skip guidance for MCP unavailable (not old FAIL-for-MCP text)', () => {
    const result = buildManualQaContext({ mode: 'local', previewCommand: 'npm run dev' }, {});

    // Should include the new skip guidance
    expect(result).toMatch(/skipped? \(MCP unavailable\)/i);
    expect(result).toMatch(/mcp__Claude_Preview/i);

    // Should NOT contain the old text that instructs FAIL when MCP is unavailable
    expect(result).not.toMatch(/MCP unavailable.*set the verdict to FAIL/i);
    expect(result).not.toMatch(/set the verdict to FAIL.*MCP unavailable/i);
  });

  it('with mode "local" still instructs FAIL for actual failures (deploy unhealthy, app errors)', () => {
    const result = buildManualQaContext({ mode: 'local', previewCommand: 'npm run dev' }, {});

    // Actual failures (not MCP absence) should still set FAIL
    expect(result).toMatch(/actual failure|deploy unhealthy|FAIL/i);
  });

  it('with mode "off" returns empty string (regression)', () => {
    const result = buildManualQaContext({ mode: 'off' }, {});
    expect(result).toBe('');
  });

  it('with undefined config returns empty string (regression)', () => {
    const result = buildManualQaContext(undefined, {});
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildBaseBranchContext
// ---------------------------------------------------------------------------

describe('buildBaseBranchContext', () => {
  it('returns string containing "**Base branch**: qa" when called with "qa"', () => {
    const result = buildBaseBranchContext('qa');
    expect(result).toContain('**Base branch**: qa');
  });

  it('returns string containing "**Base branch**: main" when called with "main"', () => {
    const result = buildBaseBranchContext('main');
    expect(result).toContain('**Base branch**: main');
  });

  it('returns empty string when called with undefined', () => {
    const result = buildBaseBranchContext(undefined);
    expect(result).toBe('');
  });

  it('returns empty string when called with empty string', () => {
    const result = buildBaseBranchContext('');
    expect(result).toBe('');
  });
});
