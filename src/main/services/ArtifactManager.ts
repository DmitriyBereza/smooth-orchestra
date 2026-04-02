import fs from 'fs';
import path from 'path';
import { ArtifactType, ArtifactMeta, ARTIFACT_FILENAMES, STAGE_ARTIFACTS, PipelineStage, AgentRole } from '../types';
import { eventBus } from './EventBus';

/**
 * Manages markdown artifact files in the .orchestra/ directory.
 * Agents communicate by reading/writing structured markdown documents.
 */
export class ArtifactManager {
  private tasksDir: string;

  constructor(private orchestraDir: string) {
    this.tasksDir = path.join(orchestraDir, 'tasks');
  }

  /**
   * Ensures the task directory exists and returns its path.
   */
  getTaskDir(taskId: string): string {
    const taskDir = path.join(this.tasksDir, taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    return taskDir;
  }

  /**
   * Write an artifact file for a task.
   */
  writeArtifact(taskId: string, type: ArtifactType, content: string): string {
    const taskDir = this.getTaskDir(taskId);
    const filename = ARTIFACT_FILENAMES[type];
    const filepath = path.join(taskDir, filename);

    fs.writeFileSync(filepath, content, 'utf-8');

    eventBus.emit('artifact:written', { taskId, name: type, path: filepath });
    return filepath;
  }

  /**
   * Read an artifact file for a task.
   */
  readArtifact(taskId: string, type: ArtifactType, readerRole?: AgentRole): string | null {
    const taskDir = this.getTaskDir(taskId);
    const filename = ARTIFACT_FILENAMES[type];
    const filepath = path.join(taskDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');

    if (readerRole) {
      eventBus.emit('artifact:read', { taskId, name: type, role: readerRole });
    }

    return content;
  }

  /**
   * Check if an artifact exists for a task.
   */
  artifactExists(taskId: string, type: ArtifactType): boolean {
    const taskDir = path.join(this.tasksDir, taskId);
    const filename = ARTIFACT_FILENAMES[type];
    return fs.existsSync(path.join(taskDir, filename));
  }

  /**
   * List all artifacts for a task.
   */
  listArtifacts(taskId: string): ArtifactMeta[] {
    const taskDir = path.join(this.tasksDir, taskId);
    if (!fs.existsSync(taskDir)) return [];

    const artifacts: ArtifactMeta[] = [];
    for (const [type, filename] of Object.entries(ARTIFACT_FILENAMES)) {
      const filepath = path.join(taskDir, filename);
      if (fs.existsSync(filepath)) {
        const stat = fs.statSync(filepath);
        // Determine which stage wrote this artifact
        let stage: PipelineStage = 'idle';
        for (const [s, config] of Object.entries(STAGE_ARTIFACTS)) {
          if (config.writes.includes(type as ArtifactType)) {
            stage = s as PipelineStage;
            break;
          }
        }
        artifacts.push({
          type: type as ArtifactType,
          taskId,
          filename,
          path: filepath,
          createdAt: stat.mtime.toISOString(),
          stage,
        });
      }
    }
    return artifacts;
  }

  /**
   * Build a context string containing all artifacts a role needs to read.
   */
  buildContextForRole(taskId: string, role: AgentRole): string {
    const stageConfig = STAGE_ARTIFACTS[role];
    if (!stageConfig) return '';

    const sections: string[] = [];

    for (const artifactType of stageConfig.reads) {
      const content = this.readArtifact(taskId, artifactType, role);
      if (content) {
        sections.push(`## ${artifactType.toUpperCase()}\n\n${content}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Delete all artifacts for a task.
   */
  cleanupTask(taskId: string): void {
    const taskDir = path.join(this.tasksDir, taskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  }
}
