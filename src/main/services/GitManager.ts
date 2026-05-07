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

  /**
   * Create a subtask branch from a parent branch (not from current HEAD).
   * Checks out a new branch starting from parentBranch.
   */
  async createSubtaskBranch(parentBranch: string, subtaskName: string, taskId: string): Promise<void> {
    await this.git('checkout', '-b', subtaskName, parentBranch);
    eventBus.emit('git:branch-created', { branch: subtaskName, taskId });
  }

  /**
   * Merge source branch into target branch using --no-ff.
   * Returns success status and any conflict file paths on failure.
   */
  async mergeBranch(source: string, target: string, taskId: string): Promise<{ success: boolean; conflicts?: string[] }> {
    eventBus.emit('git:merge-started', { source, target, taskId });
    await this.switchBranch(target);
    try {
      await this.git('merge', source, '--no-ff', '-m', `Merge ${source} into ${target}`);
      eventBus.emit('git:merge-completed', { source, target, taskId });
      return { success: true };
    } catch {
      const conflicts = await this.parseConflictFiles();
      eventBus.emit('git:merge-conflict', { source, target, taskId, conflicts });
      // Abort the failed merge to leave the working tree clean
      await this.git('merge', '--abort').catch(() => {});
      return { success: false, conflicts };
    }
  }

  /**
   * Sequentially merge each subtask branch into parentBranch.
   * Stops on first conflict and reports which branches merged successfully.
   */
  async mergeSubtaskBranches(
    parentBranch: string,
    subtaskBranches: string[],
    taskId: string,
  ): Promise<{ success: boolean; mergedBranches: string[]; failedBranch?: string; conflicts?: string[] }> {
    const mergedBranches: string[] = [];

    for (const branch of subtaskBranches) {
      const result = await this.mergeBranch(branch, parentBranch, taskId);
      if (!result.success) {
        return {
          success: false,
          mergedBranches,
          failedBranch: branch,
          conflicts: result.conflicts,
        };
      }
      mergedBranches.push(branch);
    }

    return { success: true, mergedBranches };
  }

  /**
   * Dry-run merge check: returns list of conflicting files without
   * actually completing the merge.
   */
  async getMergeConflicts(source: string, target: string): Promise<string[]> {
    await this.switchBranch(target);
    try {
      await this.git('merge', '--no-commit', '--no-ff', source);
      // No conflicts — abort the uncommitted merge
      await this.git('merge', '--abort').catch(() => {});
      return [];
    } catch {
      const conflicts = await this.parseConflictFiles();
      await this.git('merge', '--abort').catch(() => {});
      return conflicts;
    }
  }

  /**
   * Fetch origin, checkout the given branch, and fast-forward pull.
   * Stashes local changes first if the working tree is dirty; re-applies after.
   * Logs a warning and continues if the pull fails (e.g. no remote).
   */
  async pullBranch(branch: string): Promise<void> {
    const dirty = !(await this.isClean());
    if (dirty) await this.git('stash', 'push', '-m', 'orchestra-pre-sync-stash').catch(() => {});
    try {
      await this.git('fetch', 'origin');
      await this.git('checkout', branch);
      await this.git('pull', '--ff-only', 'origin', branch);
    } finally {
      if (dirty) await this.git('stash', 'pop').catch(() => {});
    }
  }

  /**
   * Merge a GitHub PR for featureBranch into baseBranch using the gh CLI.
   * Uses squash-merge and deletes the remote branch after merge.
   */
  async mergeGithubPR(featureBranch: string): Promise<void> {
    await execFileAsync(
      'gh',
      ['pr', 'merge', featureBranch, '--squash', '--delete-branch', '--yes'],
      { cwd: this.projectPath, maxBuffer: 2 * 1024 * 1024 },
    );
  }

  /**
   * Merge featureBranch into targetBranch locally, push targetBranch to origin,
   * and delete the local feature branch.
   * Used when no GitHub PR exists (project has no pr.enabled config).
   */
  async mergeLocalAndPush(featureBranch: string, targetBranch: string): Promise<void> {
    await this.switchBranch(targetBranch);
    await this.git('merge', featureBranch, '--no-ff', '-m', `Merge ${featureBranch} into ${targetBranch}`);
    await this.git('push', 'origin', targetBranch);
    await this.git('branch', '-D', featureBranch).catch(() => {});
  }

  /**
   * Show diff summary against a branch (defaults to HEAD).
   */
  async getDiffStat(branch?: string): Promise<string> {
    const args = branch ? ['diff', '--stat', branch] : ['diff', '--stat'];
    const { stdout } = await this.git(...args);
    return stdout;
  }

  /**
   * Parse conflicting file paths from `git diff --name-only --diff-filter=U`.
   */
  private async parseConflictFiles(): Promise<string[]> {
    try {
      const { stdout } = await this.git('diff', '--name-only', '--diff-filter=U');
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async git(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, {
      cwd: this.projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  }
}
