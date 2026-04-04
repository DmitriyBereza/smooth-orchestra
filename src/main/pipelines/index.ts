/**
 * Pipeline registry module.
 * Import this module to register all pipeline type configurations.
 * All three pipelines (development, marketing, design) are registered on import.
 */

// Registry must be imported first
export { registerPipeline, getPipelineConfig, getAllPipelineTypes, isPipelineTypeRegistered } from './registry';
export type { PipelineTypeConfig, ReviewStageConfig } from './registry';

// Register all pipeline configs by importing them
// Side-effect: each module calls registerPipeline() on load
import './development';
import './marketing';
import './design';

// Re-export individual configs for direct access
export { DEVELOPMENT_PIPELINE_CONFIG } from './development';
export { MARKETING_PIPELINE_CONFIG } from './marketing';
export { DESIGN_PIPELINE_CONFIG } from './design';
