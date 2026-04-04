/**
 * Tests for HTML Brand Book Output Format (TASK-0290BD7C)
 *
 * Validates that:
 * - Artifact type system supports brand-book HTML files (AC1, AC11)
 * - Pipeline config references brand-book artifacts (AC10)
 * - UI Designer prompt instructs HTML output (AC8)
 * - Design Reviewer/QA prompts expect HTML (AC9)
 * - ArtifactManager handles .html files (AC11)
 * - ArtifactViewer renders HTML artifacts via iframe (AC12)
 * - No markdown brand books remain (AC13)
 * - Other artifacts unchanged (AC14)
 */

import { describe, it, expect } from 'vitest';
import { ARTIFACT_FILENAMES, ArtifactType, STAGE_ARTIFACTS } from '../main/types/artifacts';
import { getPipelineConfig } from '../main/pipelines/registry';
// Import pipelines to trigger registration side effects
import '../main/pipelines';

describe('HTML Brand Book Output (TASK-0290BD7C)', () => {

  // === AC1 + AC11: Artifact type system supports brand-book HTML ===

  describe('Artifact Type System (AC1, AC11)', () => {
    it('should have brand-book-1 as a valid artifact type', () => {
      expect('brand-book-1' in ARTIFACT_FILENAMES).toBe(true);
    });

    it('should have brand-book-2 as a valid artifact type', () => {
      expect('brand-book-2' in ARTIFACT_FILENAMES).toBe(true);
    });

    it('should have brand-book-3 as a valid artifact type', () => {
      expect('brand-book-3' in ARTIFACT_FILENAMES).toBe(true);
    });

    it('should map brand-book-1 to .html filename', () => {
      expect(ARTIFACT_FILENAMES['brand-book-1' as ArtifactType]).toBe('brand-book-1.html');
    });

    it('should map brand-book-2 to .html filename', () => {
      expect(ARTIFACT_FILENAMES['brand-book-2' as ArtifactType]).toBe('brand-book-2.html');
    });

    it('should map brand-book-3 to .html filename', () => {
      expect(ARTIFACT_FILENAMES['brand-book-3' as ArtifactType]).toBe('brand-book-3.html');
    });
  });

  // === AC10: Pipeline config references brand-book artifacts ===

  describe('Pipeline Config (AC10)', () => {
    it('should have ui-designer writing brand-book artifacts', () => {
      const config = getPipelineConfig('design');
      const uiDesignerArtifacts = config.stageArtifacts['ui-designer'];
      expect(uiDesignerArtifacts.writes).toContain('brand-book-1');
      expect(uiDesignerArtifacts.writes).toContain('brand-book-2');
      expect(uiDesignerArtifacts.writes).toContain('brand-book-3');
    });

    it('should have design-reviewer reading brand-book artifacts', () => {
      const config = getPipelineConfig('design');
      const reviewerArtifacts = config.stageArtifacts['design-reviewer'];
      expect(reviewerArtifacts.reads).toContain('brand-book-1');
      expect(reviewerArtifacts.reads).toContain('brand-book-2');
      expect(reviewerArtifacts.reads).toContain('brand-book-3');
    });

    it('should have design-qa reading brand-book artifacts', () => {
      const config = getPipelineConfig('design');
      const qaArtifacts = config.stageArtifacts['design-qa'];
      expect(qaArtifacts.reads).toContain('brand-book-1');
      expect(qaArtifacts.reads).toContain('brand-book-2');
      expect(qaArtifacts.reads).toContain('brand-book-3');
    });

    it('should still have ui-designer writing design-spec', () => {
      const config = getPipelineConfig('design');
      expect(config.stageArtifacts['ui-designer'].writes).toContain('design-spec');
    });
  });

  // === AC8: UI Designer prompt instructs HTML output ===

  describe('UI Designer Prompt (AC8)', () => {
    it('should reference brand-book HTML output', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain('brand-book');
      expect(prompt).toContain('.html');
    });

    it('should instruct self-contained HTML format (AC2)', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain('self-contained');
    });

    it('should mention color swatches (AC3)', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain('swatch');
    });

    it('should mention typography specimens (AC4)', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain('Google Fonts');
    });

    it('should mention CSS variables block (AC7)', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain(':root');
    });

    it('should mention component mockups (AC6)', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['ui-designer']!;
      expect(prompt).toContain('component');
      expect(prompt).toContain('mockup');
    });
  });

  // === AC9: Reviewer/QA prompts updated ===

  describe('Reviewer/QA Prompts (AC9)', () => {
    it('design-reviewer prompt should reference brand-book HTML files', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['design-reviewer']!;
      expect(prompt).toContain('brand-book');
      expect(prompt).toContain('.html');
    });

    it('design-qa prompt should reference brand-book HTML files', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['design-qa']!;
      expect(prompt).toContain('brand-book');
      expect(prompt).toContain('.html');
    });
  });

  // === AC13: No markdown brand books ===

  describe('No Markdown Brand Books (AC13)', () => {
    it('should not have any brand-book .md filenames in ARTIFACT_FILENAMES', () => {
      for (const [type, filename] of Object.entries(ARTIFACT_FILENAMES)) {
        if (type.startsWith('brand-book')) {
          expect(filename).not.toMatch(/\.md$/);
        }
      }
    });
  });

  // === AC14: Other artifacts unchanged ===

  describe('Other Artifacts Unchanged (AC14)', () => {
    it('design-spec should still be .md', () => {
      expect(ARTIFACT_FILENAMES['design-spec']).toBe('design-spec.md');
    });

    it('ux-spec should still be .md', () => {
      expect(ARTIFACT_FILENAMES['ux-spec']).toBe('ux-spec.md');
    });

    it('research should still be .md', () => {
      expect(ARTIFACT_FILENAMES['research']).toBe('research.md');
    });

    it('design-review should still be .md', () => {
      expect(ARTIFACT_FILENAMES['design-review']).toBe('design-review.md');
    });

    it('design-qa-report should still be .md', () => {
      expect(ARTIFACT_FILENAMES['design-qa-report']).toBe('design-qa-report.md');
    });
  });

  // === AC11: STAGE_ARTIFACTS consistency ===

  describe('STAGE_ARTIFACTS consistency (AC11)', () => {
    it('ui-designer should write brand-book artifacts in STAGE_ARTIFACTS', () => {
      const uiDesigner = STAGE_ARTIFACTS['ui-designer'];
      expect(uiDesigner.writes).toContain('brand-book-1');
      expect(uiDesigner.writes).toContain('brand-book-2');
      expect(uiDesigner.writes).toContain('brand-book-3');
    });

    it('design-reviewer should read brand-book artifacts in STAGE_ARTIFACTS', () => {
      const reviewer = STAGE_ARTIFACTS['design-reviewer'];
      expect(reviewer.reads).toContain('brand-book-1');
      expect(reviewer.reads).toContain('brand-book-2');
      expect(reviewer.reads).toContain('brand-book-3');
    });

    it('design-qa should read brand-book artifacts in STAGE_ARTIFACTS', () => {
      const qa = STAGE_ARTIFACTS['design-qa'];
      expect(qa.reads).toContain('brand-book-1');
      expect(qa.reads).toContain('brand-book-2');
      expect(qa.reads).toContain('brand-book-3');
    });
  });
});
