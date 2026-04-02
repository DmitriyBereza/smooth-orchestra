import { execFile } from 'child_process';
import { promisify } from 'util';
import { eventBus } from './EventBus';

const execFileAsync = promisify(execFile);

/**
 * Git operations wrapper for branch management.
 * All operations target the configured project directory.
 */
export class GitManager {
  constructor(private projectPath: string) {}

  async createBranch(name: string, taskId: string): Promise<void> {
    await this.git('checkout', '-b', name);
    eventBus.emit('git:branch-created', { branch: name, taskId });
  }

  async switchBranch(name: string): Promise<void> {
    await this.git('checkout', name);
    eventBus.emit('git:branch-switched', { branch: name });
  }

  async deleteBranch(name: string): Promise<void> {
    // Switch to main/master first if on the branch being deleted
    const current = await this.getCurrentBranch();
    if (current === name) {
      const defaultBranch = await this.getDefaultBranch();
      await this.switchBranch(defaultBranch);
    }
    await this.git('branch', '-D', name);
    eventBus.emit('git:branch-deleted', { branch: name });
  }

  async getCurrentBranch(): Promise<string> {
    const { stdout } = await this.git('rev-parse', '--abbrev-ref', 'HEAD');
    return stdout.trim();
  }

  async getDefaultBranch(): Promise<string> {
    try {
      const { stdout } = await this.git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
      return stdout.trim().replace('origin/', '');
    } catch {
      // Fallback: check if main or master exists
      try {
        await this.git('rev-parse', '--verify', 'main');
        return 'main';
      } catch {
        return 'master';
      }
    }
  }

  async branchExists(name: string): Promise<boolean> {
    try {
      await this.git('rev-parse', '--verify', name);
      return true;
    } catch {
      return false;
    }
  }

  async commitAll(message: string): Promise<void> {
    await this.git('add', '-A');
    await this.git('commit', '-m', message);
  }

  async stashChanges(): Promise<void> {
    await this.git('stash', 'push', '-m', 'orchestra-auto-stash');
  }

  async popStash(): Promise<void> {
    await this.git('stash', 'pop');
  }

  async getDiff(): Promise<string> {
    const { stdout } = await this.git('diff', '--stat');
    return stdout;
  }

  async isClean(): Promise<boolean> {
    const { stdout } = await this.git('status', '--porcelain');
    return stdout.trim() === '';
  }

  private async git(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, {
      cwd: this.projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  }
}
