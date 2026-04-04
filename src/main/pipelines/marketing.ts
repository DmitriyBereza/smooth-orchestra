import { PipelineTypeConfig, registerPipeline } from './registry';
import { PO_PROMPT } from '../prompts/po';
import {
  MARKETING_RESEARCHER_PROMPT,
  MARKETING_STRATEGIST_PROMPT,
  COPYWRITER_PROMPT,
  CREATIVE_DIRECTOR_PROMPT,
  MARKETING_QA_PROMPT,
} from '../prompts/marketing';

const MARKETING_COMPLEXITY_GUIDE = `Choose stages from this list based on campaign complexity:
- **trivial** (quick update, single piece of copy): \`copywriter\`
- **simple** (one channel, clear brief, defined audience): \`copywriter\`, \`marketing-qa\`
- **moderate** (multi-channel, strategy needed): \`marketing-strategist\`, \`copywriter\`, \`creative-director\`, \`marketing-qa\`
- **complex** (new campaign, unknown audience, competitive research needed): \`marketing-researcher\`, \`marketing-strategist\`, \`copywriter\`, \`creative-director\`, \`marketing-qa\`

Valid stages for this pipeline: marketing-researcher, marketing-strategist, copywriter, creative-director, marketing-qa`;

const MARKETING_STORY_TEMPLATE = `## Output: story.md
Write to the file \`{ARTIFACTS_DIR}/story.md\` with this structure:

\`\`\`markdown
# Campaign Brief: {title}

## Campaign Objective
[What should the audience DO after seeing this campaign? Be specific.]

## Background
[Business context: why is this campaign happening? What problem does it solve?]

## Target Audience
[Who is the primary audience? Include relevant demographic and psychographic context.]

## Key Messages
[What are the 1-3 most important things to communicate?]

## Deliverables Required
- [ ] [Specific content piece 1, e.g., "Email campaign — 3 subject line variants + body copy"]
- [ ] [Specific content piece 2, e.g., "LinkedIn posts — 3 posts"]
- [ ] [Specific content piece 3, e.g., "Hero headline for landing page"]

## Constraints
- [Brand guidelines or legal requirements]
- [Tone restrictions]
- [Channel-specific character limits if known]

## Acceptance Criteria
- [ ] AC1: [Specific, measurable criterion]
- [ ] AC2: [Specific, measurable criterion]
...

## Out of Scope
- [What this campaign does NOT include]

## Definition of Done
- All deliverables present and reviewed by Creative Director
- All acceptance criteria met
- Marketing QA approved
\`\`\``;

export const MARKETING_PIPELINE_CONFIG: PipelineTypeConfig = {
  type: 'marketing',
  displayName: 'Marketing',
  description: 'Marketing campaign pipeline with researcher, strategist, copywriter, and creative director roles',

  allStages: ['marketing-researcher', 'marketing-strategist', 'copywriter', 'creative-director', 'marketing-qa'],
  defaultPipeline: ['marketing-researcher', 'marketing-strategist', 'copywriter', 'creative-director', 'marketing-qa'],
  requiredStage: 'copywriter',

  stageToRole: {
    'marketing-researcher': 'marketing-researcher',
    'marketing-strategist': 'marketing-strategist',
    copywriter: 'copywriter',
    'creative-director': 'creative-director',
    'marketing-qa': 'marketing-qa',
  },

  stageArtifacts: {
    'marketing-researcher': {
      writes: ['research'],
      reads: ['story'],
    },
    'marketing-strategist': {
      writes: ['brief'],
      reads: ['story', 'research'],
    },
    copywriter: {
      writes: ['copy'],
      reads: ['story', 'research', 'brief'],
    },
    'creative-director': {
      writes: ['creative-review'],
      reads: ['story', 'brief', 'copy'],
    },
    'marketing-qa': {
      writes: ['marketing-qa-report'],
      reads: ['story', 'brief', 'copy', 'creative-review'],
    },
  },

  reviewStages: [
    {
      stage: 'creative-director',
      decisionArtifact: 'creative-review',
      rejectTarget: 'copywriter',
    },
  ],

  qaStage: 'marketing-qa',
  supportsParallelExecution: false,

  poComplexityGuide: MARKETING_COMPLEXITY_GUIDE,
  storyTemplate: MARKETING_STORY_TEMPLATE,

  rolePrompts: {
    po: PO_PROMPT,
    'marketing-researcher': MARKETING_RESEARCHER_PROMPT,
    'marketing-strategist': MARKETING_STRATEGIST_PROMPT,
    copywriter: COPYWRITER_PROMPT,
    'creative-director': CREATIVE_DIRECTOR_PROMPT,
    'marketing-qa': MARKETING_QA_PROMPT,
  },
};

// Register on module load
registerPipeline(MARKETING_PIPELINE_CONFIG);
