/**
 * Standby (idle-time improvement loop) types.
 *
 * The standby system runs three rotating roles when the user toggles it on
 * AND no task is in flight: feature researcher, tech-debt scout, and
 * regression click-through QA. Each tick produces a markdown artifact and
 * one or more BacklogItems that surface in the UI.
 */

export type StandbyRole =
  | 'tech-debt-scout'
  | 'regression-qa'
  | 'baseline-fixer'
  | 'feature-researcher'
  | 'auto-execute';

export type BacklogStatus =
  | 'draft'        // sitting in the backlog awaiting user action
  | 'auto-executed' // governor decided this was small enough to spawn a real pipeline
  | 'promoted'     // user clicked "Promote to pipeline" — became a real task
  | 'dismissed';   // user clicked dismiss — won't surface again (recorded in role memory)

export interface BacklogItem {
  id: string;
  source: StandbyRole;
  createdAt: string;
  /** Short title shown on the backlog card. */
  title: string;
  /** Full proposal markdown (shown when card is expanded). */
  body: string;
  status: BacklogStatus;
  /** Optional complexity tag from the tech-debt scout. */
  complexity?: 'small' | 'medium' | 'large';
  /** Estimated number of files touched (used by the auto-execute governor). */
  estimatedFiles?: number;
  /** When promoted to a real task, the resulting task ID. */
  promotedTaskId?: string;
  /** Free-form note explaining why a card was auto-executed or dismissed. */
  note?: string;
  /** Project this item was generated for — used to pre-select promote target. */
  projectId?: string;
  /** Project name (display-only convenience). */
  projectName?: string;
}

export interface StandbyState {
  enabled: boolean;
  /** Index into STANDBY_ROLES — advances each tick. */
  rotationIndex: number;
  /** Index into the standby-target project list — advances each tick. */
  projectRotationIndex: number;
  /** Last successful tick timestamp (ISO). */
  lastTickAt: string | null;
  /** When the next tick is scheduled (ISO) — informational only, the timer is in-memory. */
  nextTickAt: string | null;
  /** Auto-execute history for the rate-limit governor (timestamps, ISO). */
  autoExecutes: string[];
  /** When set, standby is paused due to a rate/usage limit (ISO timestamp when limit clears). */
  rateLimitedUntil?: string | null;
}

export const STANDBY_ROLES: StandbyRole[] = [
  'tech-debt-scout',
  'regression-qa',
  'baseline-fixer',
  'feature-researcher',
  'auto-execute',
];
