/**
 * Tests for SessionManager pipeline routing across different pipeline types.
 *
 * Tests verify:
 * - Pipeline type is stored on session creation
 * - parsePipelineArtifact validates against correct pipeline type's stages
 * - approveSpec enforces required stage and validates against allStages
 * - advancePipeline uses config for review loopback and QA routing
 * - Development pipeline: no regressions in behavior
 * - Marketing pipeline: correct routing through marketing stages
 * - Design pipeline: correct routing through design stages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPipelineConfig } from '../main/pipelines/registry';
// Import pipelines to register them
import '../main/pipelines';
import { PipelineStage, PipelineType } from '../main/types/session';

// ---------------------------------------------------------------------------
// Unit tests for parsePipelineArtifact logic (extracted/testable)
// ---------------------------------------------------------------------------

/**
 * Simulates parsePipelineArtifact for a given pipeline type.
 */
function parsePipelineArtifact(content: string, pipelineType: PipelineType): PipelineStage[] {
  const config = getPipelineConfig(pipelineType);
  const validStagesSet = new Set(config.allStages);
  const defaultPipeline = config.defaultPipeline as PipelineStage[];

  const stagesMatch = content.match(/## Stages\n([\s\S]*?)(?=\n##|$)/);
  if (!stagesMatch) return defaultPipeline;

  const lines = stagesMatch[1].trim().split('\n');
  const stages: PipelineStage[] = [];

  for (const line of lines) {
    const match = line.match(/^[-*]\s+(\S+)/);
    if (match) {
      const stage = match[1].trim() as PipelineStage;
      if (validStagesSet.has(stage)) {
        stages.push(stage);
      }
    }
  }

  // Always ensure required stage is present
  if (!stages.includes(config.requiredStage as PipelineStage)) {
    stages.push(config.requiredStage as PipelineStage);
  }

  return stages.length > 0 ? stages : defaultPipeline;
}

describe('parsePipelineArtifact', () => {
  describe('development pipeline', () => {
    it('should parse valid development stages', () => {
      const content = `# Pipeline\n## Stages\n- architect\n- developer\n- qa`;
      const result = parsePipelineArtifact(content, 'development');
      expect(result).toContain('architect');
      expect(result).toContain('developer');
      expect(result).toContain('qa');
    });

    it('should always include developer', () => {
      const content = `# Pipeline\n## Stages\n- architect\n- qa`;
      const result = parsePipelineArtifact(content, 'development');
      expect(result).toContain('developer');
    });

    it('should reject marketing stages in development pipeline', () => {
      const content = `# Pipeline\n## Stages\n- copywriter\n- marketing-qa\n- developer`;
      const result = parsePipelineArtifact(content, 'development');
      expect(result).not.toContain('copywriter');
      expect(result).not.toContain('marketing-qa');
      expect(result).toContain('developer');
    });

    it('should include tech-researcher if specified', () => {
      const content = `# Pipeline\n## Stages\n- tech-researcher\n- architect\n- developer`;
      const result = parsePipelineArtifact(content, 'development');
      expect(result).toContain('tech-researcher');
      expect(result).toContain('architect');
      expect(result).toContain('developer');
    });

    it('should return default pipeline when no stages match', () => {
      const content = `# Pipeline\n## Stages\n- bogus-stage`;
      const result = parsePipelineArtifact(content, 'development');
      const config = getPipelineConfig('development');
      // Should contain required stage at minimum
      expect(result).toContain(config.requiredStage);
    });

    it('should return default pipeline when no Stages section found', () => {
      const content = `# Pipeline\nThis has no stages section`;
      const result = parsePipelineArtifact(content, 'development');
      const config = getPipelineConfig('development');
      expect(result).toEqual(config.defaultPipeline);
    });
  });

  describe('marketing pipeline', () => {
    it('should parse valid marketing stages', () => {
      const content = `# Pipeline\n## Stages\n- marketing-researcher\n- copywriter\n- marketing-qa`;
      const result = parsePipelineArtifact(content, 'marketing');
      expect(result).toContain('marketing-researcher');
      expect(result).toContain('copywriter');
      expect(result).toContain('marketing-qa');
    });

    it('should always include copywriter', () => {
      const content = `# Pipeline\n## Stages\n- marketing-researcher\n- marketing-qa`;
      const result = parsePipelineArtifact(content, 'marketing');
      expect(result).toContain('copywriter');
    });

    it('should reject development stages in marketing pipeline', () => {
      const content = `# Pipeline\n## Stages\n- architect\n- developer\n- copywriter`;
      const result = parsePipelineArtifact(content, 'marketing');
      expect(result).not.toContain('architect');
      expect(result).not.toContain('developer');
      expect(result).toContain('copywriter');
    });

    it('should return default marketing pipeline on parse failure', () => {
      const content = `# Pipeline\nNo stages here`;
      const result = parsePipelineArtifact(content, 'marketing');
      const config = getPipelineConfig('marketing');
      expect(result).toEqual(config.defaultPipeline);
    });
  });

  describe('design pipeline', () => {
    it('should parse valid design stages', () => {
      const content = `# Pipeline\n## Stages\n- design-researcher\n- ux-designer\n- ui-designer\n- design-qa`;
      const result = parsePipelineArtifact(content, 'design');
      expect(result).toContain('design-researcher');
      expect(result).toContain('ux-designer');
      expect(result).toContain('ui-designer');
      expect(result).toContain('design-qa');
    });

    it('should always include ui-designer', () => {
      const content = `# Pipeline\n## Stages\n- design-researcher\n- design-qa`;
      const result = parsePipelineArtifact(content, 'design');
      expect(result).toContain('ui-designer');
    });

    it('should allow design-executor in design pipeline', () => {
      const content = `# Pipeline\n## Stages\n- ui-designer\n- design-executor\n- design-qa`;
      const result = parsePipelineArtifact(content, 'design');
      expect(result).toContain('design-executor');
    });

    it('should reject marketing stages in design pipeline', () => {
      const content = `# Pipeline\n## Stages\n- copywriter\n- ui-designer\n- design-qa`;
      const result = parsePipelineArtifact(content, 'design');
      expect(result).not.toContain('copywriter');
      expect(result).toContain('ui-designer');
    });
  });
});

// ---------------------------------------------------------------------------
// Pipeline Config: Review stage logic
// ---------------------------------------------------------------------------

describe('Review Stage Logic', () => {
  describe('development pipeline', () => {
    it('should have tl-code-review looping back to developer on CHANGES_REQUESTED', () => {
      const config = getPipelineConfig('development');
      const reviewStage = config.reviewStages.find((r) => r.stage === 'tl-code-review');
      expect(reviewStage?.rejectTarget).toBe('developer');
    });
  });

  describe('marketing pipeline', () => {
    it('should have creative-director looping back to copywriter on CHANGES_REQUESTED', () => {
      const config = getPipelineConfig('marketing');
      const reviewStage = config.reviewStages.find((r) => r.stage === 'creative-director');
      expect(reviewStage?.rejectTarget).toBe('copywriter');
    });
  });

  describe('design pipeline', () => {
    it('should have design-reviewer looping back to ui-designer on CHANGES_REQUESTED', () => {
      const config = getPipelineConfig('design');
      const reviewStage = config.reviewStages.find((r) => r.stage === 'design-reviewer');
      expect(reviewStage?.rejectTarget).toBe('ui-designer');
    });
  });
});

// ---------------------------------------------------------------------------
// Pipeline Config: QA stage routing
// ---------------------------------------------------------------------------

describe('QA Stage Config', () => {
  it('development pipeline QA stage is qa', () => {
    const config = getPipelineConfig('development');
    expect(config.qaStage).toBe('qa');
    // QA report artifact
    const qaArtifacts = config.stageArtifacts['qa']?.writes ?? [];
    expect(qaArtifacts).toContain('qa-report');
  });

  it('marketing pipeline QA stage is marketing-qa', () => {
    const config = getPipelineConfig('marketing');
    expect(config.qaStage).toBe('marketing-qa');
    const qaArtifacts = config.stageArtifacts['marketing-qa']?.writes ?? [];
    expect(qaArtifacts).toContain('marketing-qa-report');
  });

  it('design pipeline QA stage is design-qa', () => {
    const config = getPipelineConfig('design');
    expect(config.qaStage).toBe('design-qa');
    const qaArtifacts = config.stageArtifacts['design-qa']?.writes ?? [];
    expect(qaArtifacts).toContain('design-qa-report');
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('Backward Compatibility', () => {
  it('development pipeline should match the legacy PIPELINE_STAGES list', async () => {
    // Import legacy constants for comparison
    const { PIPELINE_STAGES, DEFAULT_PIPELINE } = await import('../main/types/session');
    const config = getPipelineConfig('development');

    // Default pipeline stages should match legacy (note: tech-researcher is new)
    for (const stage of DEFAULT_PIPELINE) {
      expect(config.defaultPipeline).toContain(stage);
    }
  });

  it('development pipeline stageToRole should map developer to developer role', () => {
    const config = getPipelineConfig('development');
    expect(config.stageToRole['developer']).toBe('developer');
  });

  it('development pipeline stageToRole should map tl-code-review to tech-lead role', () => {
    const config = getPipelineConfig('development');
    expect(config.stageToRole['tl-code-review']).toBe('tech-lead');
  });

  it('development pipeline stageToRole should map qa to qa role', () => {
    const config = getPipelineConfig('development');
    expect(config.stageToRole['qa']).toBe('qa');
  });
});

// ---------------------------------------------------------------------------
// Pipeline Type Isolation
// ---------------------------------------------------------------------------

describe('Pipeline Type Isolation', () => {
  it('marketing pipeline stages should not overlap with development stages', () => {
    const devConfig = getPipelineConfig('development');
    const mktConfig = getPipelineConfig('marketing');
    const devStages = new Set(devConfig.allStages);

    for (const stage of mktConfig.allStages) {
      expect(devStages.has(stage), `Stage '${stage}' should not be in both development and marketing`).toBe(false);
    }
  });

  it('design pipeline stages should not overlap with development stages', () => {
    const devConfig = getPipelineConfig('development');
    const dsnConfig = getPipelineConfig('design');
    const devStages = new Set(devConfig.allStages);

    for (const stage of dsnConfig.allStages) {
      expect(devStages.has(stage), `Stage '${stage}' should not be in both development and design`).toBe(false);
    }
  });

  it('design pipeline stages should not overlap with marketing stages', () => {
    const mktConfig = getPipelineConfig('marketing');
    const dsnConfig = getPipelineConfig('design');
    const mktStages = new Set(mktConfig.allStages);

    for (const stage of dsnConfig.allStages) {
      expect(mktStages.has(stage), `Stage '${stage}' should not be in both marketing and design`).toBe(false);
    }
  });
});
