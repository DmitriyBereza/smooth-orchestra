export interface ProjectRecord {
  id: string;
  name: string;
  path: string; // absolute local path to the codebase
  labels: string[];
  createdAt: string;
  updatedAt: string;
}
