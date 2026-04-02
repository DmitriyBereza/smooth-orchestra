import { PipelineStage } from './session';

export type ArtifactType =
  | 'story'
  | 'questions'
  | 'design'
  | 'dev-tasks'
  | 'dev-notes'
  | 'qa-spec'
  | 'review'
  | 'qa-report';

export interface ArtifactMeta {
  type: ArtifactType;
  taskId: string;
  filename: string;
  path: string;
  createdAt: string;
  stage: PipelineStage;
}

export const STAGE_ARTIFACTS: Record<string, { writes: ArtifactType[]; reads: ArtifactType[] }> = {
  po: {
    writes: ['story', 'questions'],
    reads: [],
  },
  architect: {
    writes: ['design', 'dev-tasks'],
    reads: ['story'],
  },
  'tech-lead': {
    writes: ['review'],
    reads: ['story', 'design', 'dev-tasks'],
  },
  developer: {
    writes: ['dev-notes', 'qa-spec'],
    reads: ['story', 'design', 'dev-tasks', 'review'],
  },
  qa: {
    writes: ['qa-report'],
    reads: ['story', 'qa-spec', 'dev-notes'],
  },
};

export const ARTIFACT_FILENAMES: Record<ArtifactType, string> = {
  story: 'story.md',
  questions: 'questions.md',
  design: 'design.md',
  'dev-tasks': 'dev-tasks.md',
  'dev-notes': 'dev-notes.md',
  'qa-spec': 'qa-spec.md',
  review: 'review.md',
  'qa-report': 'qa-report.md',
};
