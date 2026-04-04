/**
 * Shared pipeline configuration data — used by both the frontend and backend.
 * Contains ONLY plain data (no Node.js imports).
 *
 * Backend augments this with prompt functions and artifact I/O configs.
 * Frontend uses this for rendering pipeline steps, stage labels, and colors.
 */

export type PipelineType = 'development' | 'marketing' | 'design';

export interface SharedStageConfig {
  stage: string;
  label: string;
  description: string;
  color: string;
  isReviewGate?: boolean; // true if this is awaiting_user_review / awaiting_merge_approval
}

export interface SharedPipelineConfig {
  type: PipelineType;
  displayName: string;
  description: string;
  /** All pipeline-specific stages (not including common bookends like po, review gates, done) */
  allStages: SharedStageConfig[];
  /** Default active pipeline stages (subset of allStages) */
  defaultPipeline: string[];
  /** Stage that cannot be deselected */
  requiredStage: string;
  /** Does this pipeline support parallel execution? */
  supportsParallelExecution: boolean;
  /** Roles to show in the model selector for this pipeline type */
  modelSelectorRoles: { role: string; label: string; color: string }[];
}

// Common bookend stages shared by all pipelines
export const COMMON_BOOKEND_STAGES: SharedStageConfig[] = [
  { stage: 'po', label: 'PO', color: '#3B82F6', description: 'Product Owner spec' },
  { stage: 'awaiting_user_review', label: 'Review', color: '#eab308', description: 'Awaiting your review', isReviewGate: true },
  { stage: 'awaiting_merge_approval', label: 'Merge', color: '#eab308', description: 'Awaiting merge approval', isReviewGate: true },
  { stage: 'done', label: 'Done', color: '#22c55e', description: 'Task completed' },
];

export const SHARED_PIPELINE_CONFIGS: Record<PipelineType, SharedPipelineConfig> = {
  development: {
    type: 'development',
    displayName: 'Development',
    description: 'Software engineering pipeline with architect, tech lead, developer, and QA roles',
    allStages: [
      { stage: 'tech-researcher', label: 'Tech Researcher', description: 'Technology research & feasibility', color: '#06B6D4' },
      { stage: 'architect', label: 'Architect', description: 'Design doc & task breakdown', color: '#8B5CF6' },
      { stage: 'tech-lead', label: 'Tech Lead', description: 'Design review & approval', color: '#F97316' },
      { stage: 'developer', label: 'Developer', description: 'Implementation (always required)', color: '#22C55E' },
      { stage: 'tl-code-review', label: 'TL Code Review', description: 'Post-dev code review', color: '#F97316' },
      { stage: 'qa', label: 'QA', description: 'Automated testing & verification', color: '#EF4444' },
    ],
    defaultPipeline: ['architect', 'tech-lead', 'developer', 'tl-code-review', 'qa'],
    requiredStage: 'developer',
    supportsParallelExecution: true,
    modelSelectorRoles: [
      { role: 'po', label: 'PO', color: '#3B82F6' },
      { role: 'tech-researcher', label: 'Tech Researcher', color: '#06B6D4' },
      { role: 'architect', label: 'Architect', color: '#8B5CF6' },
      { role: 'tech-lead', label: 'Tech Lead', color: '#F97316' },
      { role: 'developer', label: 'Developer', color: '#22C55E' },
      { role: 'qa', label: 'QA', color: '#EF4444' },
    ],
  },

  marketing: {
    type: 'marketing',
    displayName: 'Marketing',
    description: 'Marketing campaign pipeline with researcher, strategist, copywriter, and creative director roles',
    allStages: [
      { stage: 'marketing-researcher', label: 'Researcher', description: 'Market & audience research', color: '#F59E0B' },
      { stage: 'marketing-strategist', label: 'Strategist', description: 'Campaign strategy & brief', color: '#D97706' },
      { stage: 'copywriter', label: 'Copywriter', description: 'Content creation (always required)', color: '#EC4899' },
      { stage: 'creative-director', label: 'Creative Director', description: 'Creative review & brand alignment', color: '#BE185D' },
      { stage: 'marketing-qa', label: 'Marketing QA', description: 'Final validation against brief', color: '#DC2626' },
    ],
    defaultPipeline: ['marketing-researcher', 'marketing-strategist', 'copywriter', 'creative-director', 'marketing-qa'],
    requiredStage: 'copywriter',
    supportsParallelExecution: false,
    modelSelectorRoles: [
      { role: 'po', label: 'PO', color: '#3B82F6' },
      { role: 'marketing-researcher', label: 'Researcher', color: '#F59E0B' },
      { role: 'marketing-strategist', label: 'Strategist', color: '#D97706' },
      { role: 'copywriter', label: 'Copywriter', color: '#EC4899' },
      { role: 'creative-director', label: 'Creative Director', color: '#BE185D' },
      { role: 'marketing-qa', label: 'Marketing QA', color: '#DC2626' },
    ],
  },

  design: {
    type: 'design',
    displayName: 'Design',
    description: 'UI/UX design pipeline with researcher, UX designer, UI designer, and design reviewer roles',
    allStages: [
      { stage: 'design-researcher', label: 'Researcher', description: 'User research & competitive UI survey', color: '#0EA5E9' },
      { stage: 'ux-designer', label: 'UX Designer', description: 'User flows & interaction patterns', color: '#6366F1' },
      { stage: 'ui-designer', label: 'UI Designer', description: 'Visual design spec (always required)', color: '#8B5CF6' },
      { stage: 'design-executor', label: 'Design Executor', description: 'Canva MCP design generation (optional)', color: '#A855F7' },
      { stage: 'design-reviewer', label: 'Design Reviewer', description: 'Design review against research', color: '#7C3AED' },
      { stage: 'design-qa', label: 'Design QA', description: 'Final completeness validation', color: '#4F46E5' },
    ],
    defaultPipeline: ['design-researcher', 'ux-designer', 'ui-designer', 'design-reviewer', 'design-qa'],
    requiredStage: 'ui-designer',
    supportsParallelExecution: false,
    modelSelectorRoles: [
      { role: 'po', label: 'PO', color: '#3B82F6' },
      { role: 'design-researcher', label: 'Researcher', color: '#0EA5E9' },
      { role: 'ux-designer', label: 'UX Designer', color: '#6366F1' },
      { role: 'ui-designer', label: 'UI Designer', color: '#8B5CF6' },
      { role: 'design-executor', label: 'Design Executor', color: '#A855F7' },
      { role: 'design-reviewer', label: 'Design Reviewer', color: '#7C3AED' },
      { role: 'design-qa', label: 'Design QA', color: '#4F46E5' },
    ],
  },
};

/** Get all pipeline types */
export function getAllPipelineTypes(): PipelineType[] {
  return ['development', 'marketing', 'design'];
}

/** Get shared pipeline config for a pipeline type */
export function getSharedPipelineConfig(type: PipelineType): SharedPipelineConfig {
  return SHARED_PIPELINE_CONFIGS[type];
}

/** Get the display name for a pipeline type */
export function getPipelineDisplayName(type: PipelineType): string {
  return SHARED_PIPELINE_CONFIGS[type].displayName;
}
