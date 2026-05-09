import { create } from 'zustand';

export type StandbyRole =
  | 'tech-debt-scout'
  | 'regression-qa'
  | 'baseline-fixer'
  | 'feature-researcher'
  | 'auto-execute';

export type BacklogStatus =
  | 'draft'
  | 'auto-executed'
  | 'promoted'
  | 'dismissed';

export interface BacklogItem {
  id: string;
  source: StandbyRole;
  createdAt: string;
  title: string;
  body: string;
  status: BacklogStatus;
  complexity?: 'small' | 'medium' | 'large';
  estimatedFiles?: number;
  promotedTaskId?: string;
  note?: string;
  projectId?: string;
  projectName?: string;
}

export interface StandbyState {
  enabled: boolean;
  rotationIndex: number;
  projectRotationIndex: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
  autoExecutes: string[];
}

const API_BASE = '';

interface StandbyStore {
  state: StandbyState | null;
  backlog: BacklogItem[];
  /** True while a standby agent is currently executing a tick. */
  ticking: boolean;
  setSnapshot: (data: { state: StandbyState; backlog: BacklogItem[] }) => void;
  setState: (state: StandbyState) => void;
  setBacklog: (backlog: BacklogItem[]) => void;
  setTicking: (ticking: boolean) => void;
  fetch: () => Promise<void>;
  toggle: (enabled: boolean) => Promise<void>;
  promote: (
    id: string,
    pipelineType: 'development' | 'marketing' | 'design',
    projectIds: string[],
  ) => Promise<string | null>;
  /** Stamp an already-created task back onto a backlog item (status=promoted). */
  markPromoted: (id: string, taskId: string) => Promise<void>;
  dismiss: (id: string, reason?: string) => Promise<void>;
}

export const useStandbyStore = create<StandbyStore>((set) => ({
  state: null,
  backlog: [],
  ticking: false,

  setSnapshot: (data) => set({ state: data.state, backlog: data.backlog }),
  setState: (state) => set({ state }),
  setBacklog: (backlog) => set({ backlog }),
  setTicking: (ticking) => set({ ticking }),

  fetch: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/standby`);
      const data = await res.json();
      set({ state: data.state, backlog: data.backlog });
    } catch {
      /* swallow */
    }
  },

  toggle: async (enabled) => {
    const res = await fetch(`${API_BASE}/api/standby/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (data?.state) set({ state: data.state });
  },

  promote: async (id, pipelineType, projectIds) => {
    const res = await fetch(`${API_BASE}/api/standby/backlog/${id}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineType, projectIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Promote failed (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data?.backlog)) set({ backlog: data.backlog });
    return data?.taskId ?? null;
  },

  markPromoted: async (id, taskId) => {
    const res = await fetch(`${API_BASE}/api/standby/backlog/${id}/mark-promoted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `markPromoted failed (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data?.backlog)) set({ backlog: data.backlog });
  },

  dismiss: async (id, reason) => {
    const res = await fetch(`${API_BASE}/api/standby/backlog/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Dismiss failed (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data?.backlog)) set({ backlog: data.backlog });
  },
}));
