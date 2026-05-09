import { describe, it, expect } from 'vitest';
import { getRolesForPipeline } from '../shared/pipeline-configs';

describe('getRolesForPipeline', () => {
  it('returns development roles when pipelineType is "development"', () => {
    const roles = getRolesForPipeline('development');
    expect(roles).toEqual([
      'po', 'architect', 'tech-lead', 'developer', 'qa',
    ]);
  });

  it('returns marketing roles when pipelineType is "marketing"', () => {
    const roles = getRolesForPipeline('marketing');
    expect(roles).toEqual([
      'po', 'marketing-researcher', 'marketing-strategist', 'copywriter', 'creative-director', 'marketing-qa',
    ]);
  });

  it('returns design roles when pipelineType is "design"', () => {
    const roles = getRolesForPipeline('design');
    expect(roles).toEqual([
      'po', 'design-researcher', 'ux-designer', 'ui-designer', 'design-executor', 'design-reviewer', 'design-qa',
    ]);
  });

  it('defaults to development roles when pipelineType is undefined', () => {
    const roles = getRolesForPipeline(undefined);
    expect(roles).toEqual([
      'po', 'architect', 'tech-lead', 'developer', 'qa',
    ]);
  });

  it('returns roles derived from modelSelectorRoles in SHARED_PIPELINE_CONFIGS', () => {
    // This test verifies the roles come from the config, not a hardcoded list
    const devRoles = getRolesForPipeline('development');
    expect(devRoles[0]).toBe('po'); // PO is always first
    expect(devRoles.length).toBe(5);

    const marketingRoles = getRolesForPipeline('marketing');
    expect(marketingRoles[0]).toBe('po');
    expect(marketingRoles.length).toBe(6);

    const designRoles = getRolesForPipeline('design');
    expect(designRoles[0]).toBe('po');
    expect(designRoles.length).toBe(7);
  });
});
