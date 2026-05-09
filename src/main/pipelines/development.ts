import { PipelineTypeConfig, registerPipeline } from './registry';
import { PO_PROMPT } from '../prompts/po';
import { ARCHITECT_PROMPT } from '../prompts/architect';
import { TECH_LEAD_PROMPT, TECH_LEAD_CODE_REVIEW_PROMPT } from '../prompts/tech-lead';
import { DEVELOPER_PROMPT } from '../prompts/developer';
import { QA_PROMPT } from '../prompts/qa';


const DEVELOPMENT_COMPLEXITY_GUIDE = `Choose stages from this list based on complexity:
- **trivial** (text/copy change, config tweak, rename): \`developer\`
- **simple** (small isolated change, obvious fix): \`developer\`, \`qa\`
- **moderate** (feature with some logic, multi-file change): \`developer\`, \`tl-code-review\`, \`qa\`
- **complex** (new feature, architectural change, multi-component): \`architect\`, \`tech-lead\`, \`developer\`, \`tl-code-review\`, \`qa\`

Valid stages for this pipeline: architect, tech-lead, developer, tl-code-review, qa`;

const DEVELOPMENT_STORY_TEMPLATE = `## Output: story.md
Write to the file \`{ARTIFACTS_DIR}/story.md\` with this structure:

\`\`\`markdown
# User Story: {title}

## Description
As a [user type], I want [capability] so that [benefit].

## Background
[Any relevant context, constraints, or dependencies]

## Acceptance Criteria
- [ ] AC1: [Specific, testable criterion]
- [ ] AC2: [Specific, testable criterion]
- [ ] AC3: [Specific, testable criterion]
...

## Out of Scope
- [Explicitly list what this task does NOT include]

## Definition of Done
- All acceptance criteria are met
- Tests written and passing
- Code reviewed by Tech Lead
- QA verified
\`\`\``;

export const DEVELOPMENT_PIPELINE_CONFIG: PipelineTypeConfig = {
  type: 'development',
  displayName: 'Development',
  description: 'Software engineering pipeline with architect, tech lead, developer, and QA roles',

  allStages: ['architect', 'tech-lead', 'developer', 'tl-code-review', 'qa'],
  defaultPipeline: ['architect', 'tech-lead', 'developer', 'tl-code-review', 'qa'],
  requiredStage: 'developer',

  stageToRole: {
    architect: 'architect',
    'tech-lead': 'tech-lead',
    developer: 'developer',
    'tl-code-review': 'tech-lead',
    qa: 'qa',
  },

  stageArtifacts: {
    architect: {
      writes: ['design', 'dev-tasks'],
      reads: ['story', 'research'],
    },
    'tech-lead': {
      writes: ['review'],
      reads: ['story', 'design', 'dev-tasks'],
    },
    developer: {
      writes: ['dev-notes', 'qa-spec'],
      reads: ['story', 'design', 'dev-tasks', 'review', 'tl-code-review'],
    },
    'tl-code-review': {
      writes: ['tl-code-review'],
      reads: ['story', 'design', 'dev-tasks', 'dev-notes', 'qa-spec'],
    },
    qa: {
      writes: ['qa-report'],
      reads: ['story', 'qa-spec', 'dev-notes'],
    },
  },

  reviewStages: [
    {
      stage: 'tl-code-review',
      decisionArtifact: 'tl-code-review',
      rejectTarget: 'developer',
    },
  ],

  qaStage: 'qa',
  supportsParallelExecution: true,

  poComplexityGuide: DEVELOPMENT_COMPLEXITY_GUIDE,
  storyTemplate: DEVELOPMENT_STORY_TEMPLATE,

  rolePrompts: {
    po: PO_PROMPT,

    architect: ARCHITECT_PROMPT,
    'tech-lead': TECH_LEAD_PROMPT,
    developer: DEVELOPER_PROMPT,
    qa: QA_PROMPT,
    // tech-lead uses TECH_LEAD_CODE_REVIEW_PROMPT when stage === 'tl-code-review'
    // This override is handled in the prompt builder (buildSystemPrompt)
  },
};

// Register on module load
registerPipeline(DEVELOPMENT_PIPELINE_CONFIG);

// Export the code review prompt so the prompt builder can access it
export { TECH_LEAD_CODE_REVIEW_PROMPT };
