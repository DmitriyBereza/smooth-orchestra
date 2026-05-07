import fs from 'fs';
import path from 'path';

/**
 * One pre-existing failure recorded by the QA agent. The QA agent finds these
 * when a test/build failure reproduces on the project's `pr.baseBranch` —
 * meaning the failure is not a regression of the current PR. Instead of
 * silently dropping these, we persist them so the standby `baseline-fixer`
 * role can pick them up later, decide if the test or the code is at fault,
 * fix it, and auto-merge.
 *
 * Status lifecycle:
 *   "known" → first seen and still failing on base branch
 *   "fixing" → a baseline-fixer agent is currently working on it
 *   "fixed"  → the fixer merged a fix; entry kept for audit
 */
export type QaBaselineStatus = 'known' | 'fixing' | 'fixed';

export interface QaBaselineEntry {
  id: string;
  testName: string;
  /** Short, stable hash/snippet identifying the failure (e.g. assertion message). */
  failureSignature: string;
  /** Optional file path most likely responsible (test file or source). */
  location?: string;
  status: QaBaselineStatus;
  firstSeen: string;
  lastSeen: string;
  /** When the fixer started or finished, if applicable. */
  fixingStartedAt?: string;
  fixedAt?: string;
  /** Branch / merge commit / PR URL recorded by the fixer. */
  fixBranch?: string;
  fixMergeSha?: string;
  fixPrUrl?: string;
  /** Free-form note from QA or fixer (e.g. "test was asserting old API"). */
  note?: string;
}

export class QaBaselineRegistry {
  private readonly dir: string;

  constructor(orchestraDir: string) {
    this.dir = path.join(orchestraDir, 'qa-baseline');
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  pathFor(projectId: string): string {
    return path.join(this.dir, `${projectId}.json`);
  }

  load(projectId: string): QaBaselineEntry[] {
    const p = this.pathFor(projectId);
    if (!fs.existsSync(p)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(projectId: string, entries: QaBaselineEntry[]): void {
    const p = this.pathFor(projectId);
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf-8');
    fs.renameSync(tmp, p);
  }

  /** Pick the oldest entry with status "known" — used by the fixer to claim work. */
  pickKnown(projectId: string): QaBaselineEntry | null {
    const known = this.load(projectId).filter((e) => e.status === 'known');
    if (known.length === 0) return null;
    known.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
    return known[0];
  }
}
