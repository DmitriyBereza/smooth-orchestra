import { PipelineStage, PipelineType } from '../types/session';
import { AgentRole } from '../types/agent';
import { ArtifactType } from '../types/artifacts';

/**
 * Configuration for a review stage that can loop back to a previous stage.
 */
export interface ReviewStageConfig {
  /** The stage that performs the review */
  stage: PipelineStage;
  /** The artifact type this stage writes its decision to */
  decisionArtifact: ArtifactType;
  /** The stage to loop back to when CHANGES_REQUESTED */
  rejectTarget: PipelineStage;
}

/**
 * Complete configuration for a pipeline type.
 * Each pipeline type defines its own stage sequence, roles, artifacts, and prompts.
 */
export interface PipelineTypeConfig {
  /** The pipeline type identifier */
  type: PipelineType;
  /** Human-readable name for display */
  displayName: string;
  /** Short description of what this pipeline is for */
  description: string;
  /** All available stages for this pipeline (user can select from these) */
  allStages: PipelineStage[];
  /** Default active pipeline stages */
  defaultPipeline: PipelineStage[];
  /** Stage that cannot be deselected (e.g. 'developer', 'copywriter', 'ui-designer') */
  requiredStage: PipelineStage;
  /** Maps each stage to the agent role that runs it */
  stageToRole: Record<string, AgentRole>;
  /** Maps each stage to its readable and writable artifact types */
  stageArtifacts: Record<string, { writes: ArtifactType[]; reads: ArtifactType[] }>;
  /** Stages that perform reviews and may loop back */
  reviewStages: ReviewStageConfig[];
  /** The QA stage (if any) — triggers special rejection routing */
  qaStage: PipelineStage | null;
  /** Does this pipeline support parallel sub-task execution? */
  supportsParallelExecution: boolean;
  /** Complexity guide text injected into the PO prompt */
  poComplexityGuide: string;
  /** Domain-specific story template structure for the PO */
  storyTemplate: string;
  /** Role-specific system prompts (keyed by role) */
  rolePrompts: Partial<Record<AgentRole, string>>;
}

/** Registry of all pipeline type configurations */
const PIPELINE_REGISTRY = new Map<PipelineType, PipelineTypeConfig>();

/**
 * Register a pipeline type configuration.
 * Called by each pipeline module on initialization.
 */
export function registerPipeline(config: PipelineTypeConfig): void {
  PIPELINE_REGISTRY.set(config.type, config);
}

/**
 * Get the configuration for a specific pipeline type.
 * Falls back to 'development' if type is not registered.
 */
export function getPipelineConfig(type: PipelineType): PipelineTypeConfig {
  const config = PIPELINE_REGISTRY.get(type);
  if (!config) {
    const devConfig = PIPELINE_REGISTRY.get('development');
    if (!devConfig) {
      throw new Error(`Pipeline type '${type}' is not registered and fallback 'development' is also missing.`);
    }
    console.warn(`[PipelineRegistry] Pipeline type '${type}' not found, falling back to 'development'`);
    return devConfig;
  }
  return config;
}

/**
 * Get all registered pipeline types.
 */
export function getAllPipelineTypes(): PipelineType[] {
  return Array.from(PIPELINE_REGISTRY.keys());
}

/**
 * Check if a pipeline type is registered.
 */
export function isPipelineTypeRegistered(type: string): type is PipelineType {
  return PIPELINE_REGISTRY.has(type as PipelineType);
}
