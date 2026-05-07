import { StandbyRole } from '../../types/standby';
import { FEATURE_RESEARCHER_PROMPT } from './feature-researcher';
import { TECH_DEBT_SCOUT_PROMPT } from './tech-debt-scout';
import { REGRESSION_QA_PROMPT } from './regression-qa';
import { BASELINE_FIXER_PROMPT } from './baseline-fixer';

const STANDBY_PROMPTS: Record<StandbyRole, string> = {
  'feature-researcher': FEATURE_RESEARCHER_PROMPT,
  'tech-debt-scout': TECH_DEBT_SCOUT_PROMPT,
  'regression-qa': REGRESSION_QA_PROMPT,
  'baseline-fixer': BASELINE_FIXER_PROMPT,
};

/**
 * Get the role-specific system prompt for a standby agent.
 * The caller is responsible for substituting any placeholders
 * (`{MEMORY_PATH}`, `{OUTPUT_PATH}`, `{BACKLOG_PATH}`, `{PROJECT_PATH}`,
 * `{LAST_TASK_ID}`, `{MANUAL_QA_CONTEXT}`, `{QA_BASELINE_REGISTRY_PATH}`,
 * `{BASE_BRANCH}`) before passing to the agent.
 */
export function getStandbyPrompt(role: StandbyRole): string {
  return STANDBY_PROMPTS[role];
}

export {
  FEATURE_RESEARCHER_PROMPT,
  TECH_DEBT_SCOUT_PROMPT,
  REGRESSION_QA_PROMPT,
  BASELINE_FIXER_PROMPT,
};
