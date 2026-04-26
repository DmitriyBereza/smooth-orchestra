import { create } from 'zustand';

export interface ManualQaConfig {
  mode: 'remote' | 'local' | 'both' | 'off';
  previewCommand?: string;
  previewPort?: number;
  urls?: Record<string, string>;
}

export interface PrConfig {
  enabled: boolean;
  baseBranch?: string;
  titleTemplate?: string;
  bodyTemplate?: string;
}

export interface StandbyProjectConfig {
  enabled: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  manualQa?: ManualQaConfig;
  pr?: PrConfig;
  standby?: StandbyProjectConfig;
}

const API_BASE = '';

interface ProjectStore {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  /** IDs of all projects selected for the next task */
  selectedProjectIds: string[];
  loading: boolean;

  setProjects: (projects: ProjectRecord[]) => void;
  selectProject: (id: string | null) => void;
  toggleProject: (id: string) => void;

  fetchProjects: () => Promise<void>;
  createProject: (
    name: string,
    path: string,
    labels: string[],
    options?: { manualQa?: ManualQaConfig; pr?: PrConfig; standby?: StandbyProjectConfig },
  ) => Promise<ProjectRecord>;
  updateProject: (
    id: string,
    data: {
      name?: string;
      path?: string;
      labels?: string[];
      manualQa?: ManualQaConfig;
      pr?: PrConfig;
      standby?: StandbyProjectConfig;
    },
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  selectedProjectId: null,
  selectedProjectIds: [],
  loading: false,

  setProjects: (projects) => set({ projects }),

  selectProject: (id) => set({ selectedProjectId: id }),

  toggleProject: (id) => set((state) => {
    const ids = state.selectedProjectIds.includes(id)
      ? state.selectedProjectIds.filter((i) => i !== id)
      : [...state.selectedProjectIds, id];
    // First selected project becomes the primary (selectedProjectId)
    return {
      selectedProjectIds: ids,
      selectedProjectId: ids[0] ?? null,
    };
  }),

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      const projects = await res.json();
      set({ projects, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createProject: async (name, path, labels, options) => {
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, labels, ...(options ?? {}) }),
    });
    const project = await res.json();
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  updateProject: async (id, data) => {
    const res = await fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProject: async (id) => {
    await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
    set((state) => {
      const ids = state.selectedProjectIds.filter((i) => i !== id);
      return {
        projects: state.projects.filter((p) => p.id !== id),
        selectedProjectIds: ids,
        selectedProjectId: ids[0] ?? null,
      };
    });
  },
}));
