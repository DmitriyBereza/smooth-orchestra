import fs from 'fs';
import { ProjectRecord } from '../types/project';

/**
 * Synchronous, file-backed project store.
 * Same pattern as UserStore — reads from disk on every call,
 * atomic writes via tmp+rename.
 */
export class ProjectStore {
  constructor(private filePath: string) {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]), 'utf-8');
    }
  }

  all(): ProjectRecord[] {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as ProjectRecord[];
    } catch {
      return [];
    }
  }

  findById(id: string): ProjectRecord | undefined {
    return this.all().find((p) => p.id === id);
  }

  findByLabel(label: string): ProjectRecord[] {
    const normalized = label.toLowerCase();
    return this.all().filter((p) =>
      p.labels.some((l) => l.toLowerCase() === normalized),
    );
  }

  save(project: ProjectRecord): void {
    const projects = this.all();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(projects, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  delete(id: string): boolean {
    const projects = this.all();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) return false;

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(filtered, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
    return true;
  }
}
