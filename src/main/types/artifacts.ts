import { PipelineStage } from './session';

export type ArtifactType =
  // Development pipeline artifacts
  | 'story'
  | 'questions'
  | 'answers'
  | 'pipeline'
  | 'design'
  | 'dev-tasks'
  | 'dev-notes'
  | 'qa-spec'
  | 'review'
  | 'tl-code-review'
  | 'qa-report'
  // Cross-pipeline research artifact
  | 'research'
  // Marketing pipeline artifacts
  | 'brief'
  | 'copy'
  | 'creative-review'
  | 'marketing-qa-report'
  // Design pipeline artifacts
  | 'ux-spec'
  | 'design-spec'
  | 'design-assets'
  | 'design-review'
  | 'design-qa-report'
  // Brand book HTML artifacts
  | 'brand-book-1'
  | 'brand-book-2'
  | 'brand-book-3';

export interface ArtifactMeta {
  type: ArtifactType;
  taskId: string;
  filename: string;
  path: string;
  createdAt: string;
  stage: PipelineStage;
}

export const STAGE_ARTIFACTS: Record<string, { writes: ArtifactType[]; reads: ArtifactType[] }> = {
  // Development pipeline
  po: {
    writes: ['story', 'questions', 'pipeline'],
    reads: ['answers'],
  },
  'tech-researcher': {
    writes: ['research'],
    reads: ['story'],
  },
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
    reads: ['story', 'design', 'dev-tasks', 'review'],
  },
  'tl-code-review': {
    writes: ['tl-code-review'],
    reads: ['story', 'design', 'dev-tasks', 'dev-notes', 'qa-spec'],
  },
  qa: {
    writes: ['qa-report'],
    reads: ['story', 'qa-spec', 'dev-notes'],
  },
  // Marketing pipeline
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
  // Design pipeline
  'design-researcher': {
    writes: ['research'],
    reads: ['story'],
  },
  'ux-designer': {
    writes: ['ux-spec'],
    reads: ['story', 'research'],
  },
  'ui-designer': {
    writes: ['design-spec', 'brand-book-1', 'brand-book-2', 'brand-book-3'],
    reads: ['story', 'research', 'ux-spec'],
  },
  'design-executor': {
    writes: ['design-assets'],
    reads: ['design-spec', 'ux-spec'],
  },
  'design-reviewer': {
    writes: ['design-review'],
    reads: ['story', 'research', 'ux-spec', 'design-spec', 'brand-book-1', 'brand-book-2', 'brand-book-3'],
  },
  'design-qa': {
    writes: ['design-qa-report'],
    reads: ['story', 'ux-spec', 'design-spec', 'design-review', 'brand-book-1', 'brand-book-2', 'brand-book-3'],
  },
};

export const ARTIFACT_FILENAMES: Record<ArtifactType, string> = {
  // Development
  story: 'story.md',
  questions: 'questions.md',
  answers: 'answers.md',
  pipeline: 'pipeline.md',
  design: 'design.md',
  'dev-tasks': 'dev-tasks.md',
  'dev-notes': 'dev-notes.md',
  'qa-spec': 'qa-spec.md',
  review: 'review.md',
  'tl-code-review': 'tl-code-review.md',
  'qa-report': 'qa-report.md',
  // Cross-pipeline
  research: 'research.md',
  // Marketing
  brief: 'brief.md',
  copy: 'copy.md',
  'creative-review': 'creative-review.md',
  'marketing-qa-report': 'marketing-qa-report.md',
  // Design
  'ux-spec': 'ux-spec.md',
  'design-spec': 'design-spec.md',
  'design-assets': 'design-assets.md',
  'design-review': 'design-review.md',
  'design-qa-report': 'design-qa-report.md',
  // Brand book HTML artifacts
  'brand-book-1': 'brand-book-1.html',
  'brand-book-2': 'brand-book-2.html',
  'brand-book-3': 'brand-book-3.html',
};
