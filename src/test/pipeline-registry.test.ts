/**
 * Tests for the pipeline registry and all pipeline type configurations.
 *
 * RED phase: These tests define the expected behavior of the registry.
 * GREEN phase: Registry and pipeline configs must satisfy all assertions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getPipelineConfig, getAllPipelineTypes, isPipelineTypeRegistered } from '../main/pipelines/registry';
// Import pipelines — this registers them as a side effect
import '../main/pipelines';
import { ARTIFACT_FILENAMES } from '../main/types/artifacts';
import { PipelineType } from '../main/types/session';

describe('PipelineRegistry', () => {
  describe('Registration', () => {
    it('should have all three pipeline types registered', () => {
      const types = getAllPipelineTypes();
      expect(types).toContain('development');
      expect(types).toContain('marketing');
      expect(types).toContain('design');
    });

    it('should recognize valid pipeline type strings', () => {
      expect(isPipelineTypeRegistered('development')).toBe(true);
      expect(isPipelineTypeRegistered('marketing')).toBe(true);
      expect(isPipelineTypeRegistered('design')).toBe(true);
      expect(isPipelineTypeRegistered('legal')).toBe(false);
      expect(isPipelineTypeRegistered('')).toBe(false);
    });

    it('should fall back to development for unknown pipeline type', () => {
      const config = getPipelineConfig('development');
      expect(config).toBeDefined();
      expect(config.type).toBe('development');
    });
  });

  describe('Development Pipeline Config', () => {
    const config = getPipelineConfig('development');

    it('should have correct type and display name', () => {
      expect(config.type).toBe('development');
      expect(config.displayName).toBe('Development');
    });

    it('should have developer as required stage', () => {
      expect(config.requiredStage).toBe('developer');
    });

    it('should include developer in default pipeline', () => {
      expect(config.defaultPipeline).toContain('developer');
    });

    it('should have tech-researcher as optional stage', () => {
      expect(config.allStages).toContain('tech-researcher');
      // Not in default (optional)
      expect(config.defaultPipeline).not.toContain('tech-researcher');
    });

    it('should have valid stage-to-role mappings for all active stages', () => {
      for (const stage of config.allStages) {
        expect(config.stageToRole[stage]).toBeDefined();
        expect(typeof config.stageToRole[stage]).toBe('string');
      }
    });

    it('should have tl-code-review as a review stage', () => {
      const reviewStage = config.reviewStages.find((r) => r.stage === 'tl-code-review');
      expect(reviewStage).toBeDefined();
      expect(reviewStage?.rejectTarget).toBe('developer');
      expect(reviewStage?.decisionArtifact).toBe('tl-code-review');
    });

    it('should have qa as the QA stage', () => {
      expect(config.qaStage).toBe('qa');
    });

    it('should support parallel execution', () => {
      expect(config.supportsParallelExecution).toBe(true);
    });

    it('should have valid artifact configs with no unknown artifact types', () => {
      const knownArtifacts = new Set(Object.keys(ARTIFACT_FILENAMES));
      for (const [stage, stageConfig] of Object.entries(config.stageArtifacts)) {
        for (const artifact of stageConfig.writes) {
          expect(knownArtifacts.has(artifact), `Unknown artifact type '${artifact}' in stage '${stage}'`).toBe(true);
        }
        for (const artifact of stageConfig.reads) {
          expect(knownArtifacts.has(artifact), `Unknown artifact type '${artifact}' in stage '${stage}'`).toBe(true);
        }
      }
    });

    it('should have review stage targets in allStages', () => {
      for (const reviewStage of config.reviewStages) {
        expect(config.allStages).toContain(reviewStage.rejectTarget);
      }
    });

    it('should have qaStage in allStages', () => {
      if (config.qaStage) {
        expect(config.allStages).toContain(config.qaStage);
      }
    });

    it('should have defaultPipeline as subset of allStages', () => {
      for (const stage of config.defaultPipeline) {
        expect(config.allStages).toContain(stage);
      }
    });

    it('should have role prompts for all roles used by active stages', () => {
      for (const [stage, role] of Object.entries(config.stageToRole)) {
        expect(config.rolePrompts[role as any], `Missing role prompt for role '${role}' (stage: ${stage})`).toBeDefined();
      }
    });

    it('should have complexity guide and story template', () => {
      expect(config.poComplexityGuide).toBeTruthy();
      expect(config.storyTemplate).toBeTruthy();
    });
  });

  describe('Marketing Pipeline Config', () => {
    const config = getPipelineConfig('marketing');

    it('should have correct type', () => {
      expect(config.type).toBe('marketing');
    });

    it('should have copywriter as required stage', () => {
      expect(config.requiredStage).toBe('copywriter');
    });

    it('should have all 5 marketing stages', () => {
      expect(config.allStages).toContain('marketing-researcher');
      expect(config.allStages).toContain('marketing-strategist');
      expect(config.allStages).toContain('copywriter');
      expect(config.allStages).toContain('creative-director');
      expect(config.allStages).toContain('marketing-qa');
    });

    it('should include all stages in the default pipeline', () => {
      expect(config.defaultPipeline).toContain('copywriter');
      expect(config.defaultPipeline).toContain('marketing-qa');
    });

    it('should have creative-director as a review stage', () => {
      const reviewStage = config.reviewStages.find((r) => r.stage === 'creative-director');
      expect(reviewStage).toBeDefined();
      expect(reviewStage?.rejectTarget).toBe('copywriter');
      expect(reviewStage?.decisionArtifact).toBe('creative-review');
    });

    it('should have marketing-qa as QA stage', () => {
      expect(config.qaStage).toBe('marketing-qa');
    });

    it('should NOT support parallel execution', () => {
      expect(config.supportsParallelExecution).toBe(false);
    });

    it('should have marketing-qa-report written by marketing-qa', () => {
      expect(config.stageArtifacts['marketing-qa']?.writes).toContain('marketing-qa-report');
    });

    it('should have research written by marketing-researcher', () => {
      expect(config.stageArtifacts['marketing-researcher']?.writes).toContain('research');
    });

    it('should have brief written by marketing-strategist', () => {
      expect(config.stageArtifacts['marketing-strategist']?.writes).toContain('brief');
    });

    it('should have copy written by copywriter', () => {
      expect(config.stageArtifacts['copywriter']?.writes).toContain('copy');
    });

    it('should have valid stage-to-role mappings', () => {
      for (const stage of config.allStages) {
        expect(config.stageToRole[stage]).toBeDefined();
      }
    });

    it('should have role prompts for all stages', () => {
      for (const [stage, role] of Object.entries(config.stageToRole)) {
        expect(config.rolePrompts[role as any], `Missing role prompt for role '${role}' (stage: ${stage})`).toBeDefined();
      }
    });
  });

  describe('Design Pipeline Config', () => {
    const config = getPipelineConfig('design');

    it('should have correct type', () => {
      expect(config.type).toBe('design');
    });

    it('should have ui-designer as required stage', () => {
      expect(config.requiredStage).toBe('ui-designer');
    });

    it('should have all 6 design stages', () => {
      expect(config.allStages).toContain('design-researcher');
      expect(config.allStages).toContain('ux-designer');
      expect(config.allStages).toContain('ui-designer');
      expect(config.allStages).toContain('design-executor');
      expect(config.allStages).toContain('design-reviewer');
      expect(config.allStages).toContain('design-qa');
    });

    it('should have design-executor as OPTIONAL (not in default pipeline)', () => {
      expect(config.allStages).toContain('design-executor');
      expect(config.defaultPipeline).not.toContain('design-executor');
    });

    it('should have design-reviewer as a review stage', () => {
      const reviewStage = config.reviewStages.find((r) => r.stage === 'design-reviewer');
      expect(reviewStage).toBeDefined();
      expect(reviewStage?.rejectTarget).toBe('ui-designer');
      expect(reviewStage?.decisionArtifact).toBe('design-review');
    });

    it('should have design-qa as QA stage', () => {
      expect(config.qaStage).toBe('design-qa');
    });

    it('should NOT support parallel execution', () => {
      expect(config.supportsParallelExecution).toBe(false);
    });

    it('should have design-qa-report written by design-qa', () => {
      expect(config.stageArtifacts['design-qa']?.writes).toContain('design-qa-report');
    });

    it('should have ux-spec written by ux-designer', () => {
      expect(config.stageArtifacts['ux-designer']?.writes).toContain('ux-spec');
    });

    it('should have design-spec written by ui-designer', () => {
      expect(config.stageArtifacts['ui-designer']?.writes).toContain('design-spec');
    });

    it('should have design-assets written by design-executor', () => {
      expect(config.stageArtifacts['design-executor']?.writes).toContain('design-assets');
    });

    it('should have role prompts for all stages', () => {
      for (const [stage, role] of Object.entries(config.stageToRole)) {
        expect(config.rolePrompts[role as any], `Missing role prompt for role '${role}' (stage: ${stage})`).toBeDefined();
      }
    });
  });

  describe('Cross-Pipeline Integrity', () => {
    it('should have no stage name collisions between pipeline types', () => {
      const devConfig = getPipelineConfig('development');
      const mktConfig = getPipelineConfig('marketing');
      const dsnConfig = getPipelineConfig('design');

      // Marketing stages should not appear in dev stages
      for (const stage of mktConfig.allStages) {
        expect(devConfig.allStages, `Stage '${stage}' appears in both dev and marketing pipelines`).not.toContain(stage);
      }

      // Design stages should not appear in dev stages
      for (const stage of dsnConfig.allStages) {
        expect(devConfig.allStages, `Stage '${stage}' appears in both dev and design pipelines`).not.toContain(stage);
      }

      // Marketing and design shouldn't share stages either
      for (const stage of mktConfig.allStages) {
        expect(dsnConfig.allStages, `Stage '${stage}' appears in both marketing and design pipelines`).not.toContain(stage);
      }
    });

    it('all pipeline types should have non-empty role prompts', () => {
      const types: PipelineType[] = ['development', 'marketing', 'design'];
      for (const type of types) {
        const config = getPipelineConfig(type);
        expect(Object.keys(config.rolePrompts).length).toBeGreaterThan(0);
        for (const [role, prompt] of Object.entries(config.rolePrompts)) {
          expect(prompt, `Empty prompt for role '${role}' in pipeline '${type}'`).toBeTruthy();
          expect(prompt!.length).toBeGreaterThan(100); // Prompts should be substantial
        }
      }
    });

    it('all artifact types referenced should be in ARTIFACT_FILENAMES', () => {
      const knownArtifacts = new Set(Object.keys(ARTIFACT_FILENAMES));
      const types: PipelineType[] = ['development', 'marketing', 'design'];

      for (const type of types) {
        const config = getPipelineConfig(type);
        for (const [stage, stageConfig] of Object.entries(config.stageArtifacts)) {
          for (const artifact of [...stageConfig.writes, ...stageConfig.reads]) {
            expect(knownArtifacts.has(artifact), `Unknown artifact '${artifact}' in ${type}/${stage}`).toBe(true);
          }
        }
      }
    });

    it('all review stage targets should be in their pipeline allStages', () => {
      const types: PipelineType[] = ['development', 'marketing', 'design'];
      for (const type of types) {
        const config = getPipelineConfig(type);
        for (const reviewStage of config.reviewStages) {
          expect(config.allStages, `Review target '${reviewStage.rejectTarget}' not in ${type} allStages`).toContain(reviewStage.rejectTarget);
          expect(config.allStages, `Review stage '${reviewStage.stage}' not in ${type} allStages`).toContain(reviewStage.stage);
        }
      }
    });

    it('all QA stages should be in their pipeline allStages', () => {
      const types: PipelineType[] = ['development', 'marketing', 'design'];
      for (const type of types) {
        const config = getPipelineConfig(type);
        if (config.qaStage) {
          expect(config.allStages, `QA stage '${config.qaStage}' not in ${type} allStages`).toContain(config.qaStage);
        }
      }
    });

    it('all required stages should be in their defaultPipeline', () => {
      const types: PipelineType[] = ['development', 'marketing', 'design'];
      for (const type of types) {
        const config = getPipelineConfig(type);
        expect(config.defaultPipeline, `Required stage '${config.requiredStage}' not in ${type} defaultPipeline`).toContain(config.requiredStage);
      }
    });
  });

  describe('Researcher Role Standards (AC12)', () => {
    it('marketing-researcher prompt should mention research.md output', () => {
      const config = getPipelineConfig('marketing');
      const prompt = config.rolePrompts['marketing-researcher'];
      expect(prompt).toContain('research.md');
    });

    it('design-researcher prompt should mention research.md output', () => {
      const config = getPipelineConfig('design');
      const prompt = config.rolePrompts['design-researcher'];
      expect(prompt).toContain('research.md');
    });

    it('tech-researcher prompt should mention research.md output', () => {
      const config = getPipelineConfig('development');
      const prompt = config.rolePrompts['tech-researcher'];
      expect(prompt).toContain('research.md');
    });

    it('researcher roles should write research artifact first in their pipeline', () => {
      // Marketing researcher is first active stage
      const mktConfig = getPipelineConfig('marketing');
      expect(mktConfig.defaultPipeline[0]).toBe('marketing-researcher');

      // Design researcher is first active stage
      const dsnConfig = getPipelineConfig('design');
      expect(dsnConfig.defaultPipeline[0]).toBe('design-researcher');
    });

    it('researcher prompts should mention standard research.md sections', () => {
      const configs: PipelineType[] = ['development', 'marketing', 'design'];
      const researcherRoles: Record<PipelineType, string> = {
        development: 'tech-researcher',
        marketing: 'marketing-researcher',
        design: 'design-researcher',
      };

      for (const type of configs) {
        const config = getPipelineConfig(type);
        const role = researcherRoles[type];
        const prompt = config.rolePrompts[role as any];
        expect(prompt).toContain('Summary');
        expect(prompt).toContain('Key Findings');
        expect(prompt).toContain('Recommendations');
      }
    });
  });
});
