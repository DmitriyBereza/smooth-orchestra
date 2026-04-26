import { AgentRole, PipelineStage, PipelineType } from '../types';
import { buildBaseContext } from './base';
import { buildPOPrompt, PO_PROMPT } from './po';
import { ARCHITECT_PROMPT } from './architect';
import { TECH_LEAD_PROMPT, TECH_LEAD_CODE_REVIEW_PROMPT } from './tech-lead';
import { DEVELOPER_PROMPT } from './developer';
import { QA_PROMPT } from './qa';
import { TECH_RESEARCHER_PROMPT } from './tech-researcher';
// Import all pipeline-type-specific prompts
import { getPipelineConfig } from '../pipelines/registry';
// Ensure all pipelines are registered
import '../pipelines';

/**
 * Fallback role prompts for backward compatibility.
 * New roles use pipeline config's rolePrompts map.
 */
const LEGACY_ROLE_PROMPTS: Partial<Record<AgentRole, string>> = {
  po: PO_PROMPT,
  'tech-researcher': TECH_RESEARCHER_PROMPT,
  architect: ARCHITECT_PROMPT,
  'tech-lead': TECH_LEAD_PROMPT,
  developer: DEVELOPER_PROMPT,
  qa: QA_PROMPT,
};

export interface PromptExtras {
  /** Manual-QA block injected at {MANUAL_QA_CONTEXT}. Empty string when manual QA is off. */
  manualQaContext?: string;
  /** Auto-PR block injected at {PR_CONFIG_CONTEXT}. Empty string when auto-PR is off. */
  prContext?: string;
}

/**
 * Build the complete system prompt for an agent, combining:
 * 1. Base context (team structure, communication protocol)
 * 2. Project context (codebase info, constraints)
 * 3. Role-specific prompt (varies by stage and pipeline type)
 *
 * @param role - The agent role
 * @param projectContext - Project context string
 * @param stage - Current pipeline stage (used for stage-specific overrides)
 * @param artifactDir - Absolute path to this task's artifact directory, injected in place of {ARTIFACTS_DIR}
 * @param pipelineType - Pipeline type for domain-specific prompt dispatch
 * @param extras - Optional manualQa / pr context blocks for placeholder substitution
 */
export function buildSystemPrompt(
  role: AgentRole,
  projectContext: string,
  stage?: PipelineStage,
  artifactDir?: string,
  pipelineType: PipelineType = 'development',
  extras: PromptExtras = {},
): string {
  const base = buildBaseContext(projectContext);
  let rolePrompt: string;

  // PO prompt varies by pipeline type
  if (role === 'po') {
    rolePrompt = buildPOPrompt(pipelineType);
  }
  // Override prompt when the tech-lead is doing a code review (development pipeline)
  else if (stage === 'tl-code-review' && role === 'tech-lead') {
    rolePrompt = TECH_LEAD_CODE_REVIEW_PROMPT;
  }
  // Try to get prompt from the pipeline config's rolePrompts map
  else {
    const config = getPipelineConfig(pipelineType);
    const configPrompt = config.rolePrompts[role];
    if (configPrompt) {
      rolePrompt = configPrompt;
    } else {
      // Fall back to legacy prompts for backward compatibility
      rolePrompt = LEGACY_ROLE_PROMPTS[role] ?? `## Your Role: ${role}\n\nProcess the current stage and write your output artifacts.\n`;
    }
  }

  let combined = `${base}\n\n${rolePrompt}`;

  // Replace placeholder with absolute artifact directory so agents write to the right place
  if (artifactDir) {
    combined = combined.replaceAll('{ARTIFACTS_DIR}', artifactDir);
  }

  // Replace context placeholders (empty string when not provided — placeholders silently disappear)
  combined = combined.replaceAll('{MANUAL_QA_CONTEXT}', extras.manualQaContext ?? '');
  combined = combined.replaceAll('{PR_CONFIG_CONTEXT}', extras.prContext ?? '');

  return combined;
}

/**
 * Build the initial task prompt sent to an agent when it starts working.
 * Optionally includes subtask assignment details for parallel dev.
 */
export function buildTaskPrompt(
  role: AgentRole,
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  artifactContext: string,
  _stage?: PipelineStage,
  subtask?: { index: number; files: string[]; title: string },
  artifactDir?: string,
): string {
  const artifactsPath = artifactDir ?? `.orchestra/tasks/${taskId}`;
  const parts = [
    `# Task Assignment`,
    ``,
    `**Task ID**: ${taskId}`,
    `**Title**: ${taskTitle}`,
    `**Description**: ${taskDescription}`,
    ``,
    `**Your artifacts directory**: \`${artifactsPath}/\``,
    `**Git branch name to use**: \`orchestra/${taskId}\``,
  ];

  if (subtask) {
    parts.push(``, `## Subtask Assignment`, ``);
    parts.push(`**Subtask ${subtask.index}**: ${subtask.title}`);
    parts.push(`**Assigned Files**: ${subtask.files.join(', ')}`);
    parts.push(`Only modify your assigned files.`);
  }

  if (artifactContext) {
    parts.push(``, `# Context from Previous Stages`, ``, artifactContext);
  }

  parts.push(
    ``,
    `Please begin your work now. Write your output artifacts to the task directory.`,
  );

  return parts.join('\n');
}
