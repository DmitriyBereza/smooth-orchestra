import { create } from 'zustand';

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '';

interface ProjectStore {
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  loading: boolean;

  setProjects: (projects: ProjectRecord[]) => void;
  selectProject: (id: string | null) => void;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, path: string, labels: string[]) => Promise<ProjectRecord>;
  updateProject: (id: string, data: { name?: string; path?: string; labels?: string[] }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,

  setProjects: (projects) => set({ projects }),

  selectProject: (id) => set({ selectedProjectId: id }),

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

  createProject: async (name, path, labels) => {
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, labels }),
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
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },
}));
