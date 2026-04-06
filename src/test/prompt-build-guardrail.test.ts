/**
 * Tests for build guardrail in developer and QA prompts.
 *
 * RED phase: These tests define the required build-check content in both prompts.
 * GREEN phase: Modify developer.ts and qa.ts to satisfy all assertions.
 */

import { describe, it, expect } from 'vitest';
import { DEVELOPER_PROMPT } from '../main/prompts/developer';
import { QA_PROMPT } from '../main/prompts/qa';

// ---------------------------------------------------------------------------
// Developer prompt — AC1, AC2, AC5
// ---------------------------------------------------------------------------

describe('DEVELOPER_PROMPT build guardrail', () => {
  it('AC1: includes an explicit build check step after tests pass', () => {
    // The prompt must mention a build check step
    expect(DEVELOPER_PROMPT).toMatch(/build check/i);
  });

  it('AC1: build check step is described as mandatory before writing dev-notes.md', () => {
    // Should instruct to run build BEFORE writing dev-notes
    const buildCheckIndex = DEVELOPER_PROMPT.toLowerCase().indexOf('build check');
    const devNotesIndex = DEVELOPER_PROMPT.toLowerCase().indexOf('dev-notes.md');
    expect(buildCheckIndex).toBeGreaterThan(-1);
    expect(devNotesIndex).toBeGreaterThan(-1);
    expect(buildCheckIndex).toBeLessThan(devNotesIndex);
  });

  it('AC2: instructs developer to document build check command in qa-spec.md "How to Run Tests" section', () => {
    expect(DEVELOPER_PROMPT).toMatch(/qa-spec\.md/i);
    // Should mention documenting the build command/step
    expect(DEVELOPER_PROMPT).toMatch(/build/i);
    expect(DEVELOPER_PROMPT).toMatch(/How to Run Tests/i);
  });

  it('AC5: instructs to detect build command from package.json rather than hard-coding', () => {
    expect(DEVELOPER_PROMPT).toMatch(/package\.json/i);
    // Should NOT hard-code "npm run build" as the only option — it should mention detection
    expect(DEVELOPER_PROMPT).toMatch(/detect|inspect|check.*package\.json|package\.json.*detect/i);
  });
});

// ---------------------------------------------------------------------------
// QA prompt — AC3, AC4, AC5, AC6
// ---------------------------------------------------------------------------

describe('QA_PROMPT build guardrail', () => {
  it('AC3: includes an explicit build check step as part of verification', () => {
    expect(QA_PROMPT).toMatch(/build check/i);
  });

  it('AC4: instructs QA to set verdict FAIL and decision REJECTED if build fails', () => {
    expect(QA_PROMPT).toMatch(/FAIL/);
    expect(QA_PROMPT).toMatch(/REJECTED/);
    // Must tie build failure to the FAIL/REJECTED outcome
    const lowerPrompt = QA_PROMPT.toLowerCase();
    const buildFailIdx = lowerPrompt.indexOf('build');
    const rejectedIdx = lowerPrompt.indexOf('rejected');
    // Both must appear
    expect(buildFailIdx).toBeGreaterThan(-1);
    expect(rejectedIdx).toBeGreaterThan(-1);
  });

  it('AC5: instructs to detect build command from package.json rather than hard-coding', () => {
    expect(QA_PROMPT).toMatch(/package\.json/i);
    expect(QA_PROMPT).toMatch(/detect|inspect|check.*package\.json|package\.json.*detect/i);
  });

  it('AC6: qa-report.md template includes a dedicated "Build Check" section', () => {
    // The QA prompt contains the qa-report template inline
    expect(QA_PROMPT).toMatch(/## Build Check/i);
  });

  it('AC6: Build Check section records the command used, output, and PASS/FAIL status', () => {
    const buildCheckSectionMatch = QA_PROMPT.match(/## Build Check[\s\S]*?(?=\n## |\n```|$)/i);
    expect(buildCheckSectionMatch).not.toBeNull();
    const section = buildCheckSectionMatch![0];
    // Should mention command
    expect(section).toMatch(/command/i);
    // Should mention output
    expect(section).toMatch(/output/i);
    // Should mention PASS/FAIL
    expect(section).toMatch(/PASS|FAIL/);
  });
});
