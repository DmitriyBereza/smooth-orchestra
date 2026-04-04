import { PipelineTypeConfig, registerPipeline } from './registry';
import { PO_PROMPT } from '../prompts/po';
import {
  DESIGN_RESEARCHER_PROMPT,
  UX_DESIGNER_PROMPT,
  UI_DESIGNER_PROMPT,
  DESIGN_EXECUTOR_PROMPT,
  DESIGN_REVIEWER_PROMPT,
  DESIGN_QA_PROMPT,
} from '../prompts/design';

const DESIGN_COMPLEXITY_GUIDE = `Choose stages from this list based on design complexity:
- **trivial** (icon swap, color update, copy tweak): \`ui-designer\`
- **simple** (single component, clear requirements): \`ui-designer\`, \`design-qa\`
- **moderate** (multi-screen feature, UX planning needed): \`ux-designer\`, \`ui-designer\`, \`design-reviewer\`, \`design-qa\`
- **complex** (new product area, unknown user needs, competitive research needed): \`design-researcher\`, \`ux-designer\`, \`ui-designer\`, \`design-reviewer\`, \`design-qa\`
- **research-heavy with execution** (full process + Canva asset generation): \`design-researcher\`, \`ux-designer\`, \`ui-designer\`, \`design-executor\`, \`design-reviewer\`, \`design-qa\`

Valid stages for this pipeline: design-researcher, ux-designer, ui-designer, design-executor, design-reviewer, design-qa`;

const DESIGN_STORY_TEMPLATE = `## Output: story.md
Write to the file \`{ARTIFACTS_DIR}/story.md\` with this structure:

\`\`\`markdown
# Design Brief: {title}

## Problem Statement
[What design problem are we solving? Who has this problem?]

## Users
[Who is the primary user of this design? Include relevant context about their needs, technical level, and usage environment.]

## Design Goals
[What should this design accomplish? What does success look like?]

## Constraints
- [Technical constraints: platform, existing design system, framework]
- [Brand/visual constraints: colors, fonts, style guidelines]
- [Accessibility requirements]
- [Performance/complexity constraints]

## Deliverables Required
- [ ] [Specific deliverable 1, e.g., "Component specification for the notification panel"]
- [ ] [Specific deliverable 2, e.g., "Responsive layout for mobile and desktop"]
- [ ] [Specific deliverable 3, e.g., "All component states: default, hover, active, disabled, loading"]

## Acceptance Criteria
- [ ] AC1: [Specific, verifiable criterion]
- [ ] AC2: [Specific, verifiable criterion]
...

## Out of Scope
- [What this design does NOT include]

## Definition of Done
- All deliverables present and reviewed
- All acceptance criteria met
- Design QA approved
\`\`\``;

export const DESIGN_PIPELINE_CONFIG: PipelineTypeConfig = {
  type: 'design',
  displayName: 'Design',
  description: 'UI/UX design pipeline with researcher, UX designer, UI designer, and design reviewer roles',

  allStages: ['design-researcher', 'ux-designer', 'ui-designer', 'design-executor', 'design-reviewer', 'design-qa'],
  defaultPipeline: ['design-researcher', 'ux-designer', 'ui-designer', 'design-reviewer', 'design-qa'],
  requiredStage: 'ui-designer',

  stageToRole: {
    'design-researcher': 'design-researcher',
    'ux-designer': 'ux-designer',
    'ui-designer': 'ui-designer',
    'design-executor': 'design-executor',
    'design-reviewer': 'design-reviewer',
    'design-qa': 'design-qa',
  },

  stageArtifacts: {
    'design-researcher': {
      writes: ['research'],
      reads: ['story'],
    },
    'ux-designer': {
      writes: ['ux-spec'],
      reads: ['story', 'research'],
    },
    'ui-designer': {
      writes: ['design-spec'],
      reads: ['story', 'research', 'ux-spec'],
    },
    'design-executor': {
      writes: ['design-assets'],
      reads: ['design-spec', 'ux-spec'],
    },
    'design-reviewer': {
      writes: ['design-review'],
      reads: ['story', 'research', 'ux-spec', 'design-spec'],
    },
    'design-qa': {
      writes: ['design-qa-report'],
      reads: ['story', 'ux-spec', 'design-spec', 'design-review'],
    },
  },

  reviewStages: [
    {
      stage: 'design-reviewer',
      decisionArtifact: 'design-review',
      rejectTarget: 'ui-designer',
    },
  ],

  qaStage: 'design-qa',
  supportsParallelExecution: false,

  poComplexityGuide: DESIGN_COMPLEXITY_GUIDE,
  storyTemplate: DESIGN_STORY_TEMPLATE,

  rolePrompts: {
    po: PO_PROMPT,
    'design-researcher': DESIGN_RESEARCHER_PROMPT,
    'ux-designer': UX_DESIGNER_PROMPT,
    'ui-designer': UI_DESIGNER_PROMPT,
    'design-executor': DESIGN_EXECUTOR_PROMPT,
    'design-reviewer': DESIGN_REVIEWER_PROMPT,
    'design-qa': DESIGN_QA_PROMPT,
  },
};

// Register on module load
registerPipeline(DESIGN_PIPELINE_CONFIG);
