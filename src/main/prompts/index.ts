import { AgentRole } from '../types';
import { buildBaseContext } from './base';
import { PO_PROMPT } from './po';
import { ARCHITECT_PROMPT } from './architect';
import { TECH_LEAD_PROMPT } from './tech-lead';
import { DEVELOPER_PROMPT } from './developer';
import { QA_PROMPT } from './qa';

const ROLE_PROMPTS: Record<AgentRole, string> = {
  po: PO_PROMPT,
  architect: ARCHITECT_PROMPT,
  'tech-lead': TECH_LEAD_PROMPT,
  developer: DEVELOPER_PROMPT,
  qa: QA_PROMPT,
};

/**
 * Build the complete system prompt for an agent, combining:
 * 1. Base context (team structure, communication protocol)
 * 2. Project context (codebase info, constraints)
 * 3. Role-specific prompt
 */
export function buildSystemPrompt(
  role: AgentRole,
  projectContext: string,
): string {
  const base = buildBaseContext(projectContext);
  const rolePrompt = ROLE_PROMPTS[role];
  return `${base}\n\n${rolePrompt}`;
}

/**
 * Build the initial task prompt sent to an agent when it starts working.
 */
export function buildTaskPrompt(
  role: AgentRole,
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  artifactContext: string,
): string {
  const parts = [
    `# Task Assignment`,
    ``,
    `**Task ID**: ${taskId}`,
    `**Title**: ${taskTitle}`,
    `**Description**: ${taskDescription}`,
    ``,
    `**Your artifacts directory**: \`.orchestra/tasks/${taskId}/\``,
  ];

  if (artifactContext) {
    parts.push(``, `# Context from Previous Stages`, ``, artifactContext);
  }

  parts.push(
    ``,
    `Please begin your work now. Write your output artifacts to the task directory.`,
  );

  return parts.join('\n');
}
