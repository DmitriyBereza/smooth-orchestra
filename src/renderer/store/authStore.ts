import { create } from 'zustand';

const API_BASE = '';
const TOKEN_KEY = 'orchestra_token';

interface AuthStore {
  token: string | null;
  error: string | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadToken: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  error: null,
  loading: false,

  loadToken: () => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      set({ token: saved });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Login failed' }));
        set({ loading: false, error: data.error || 'Login failed' });
        return false;
      }

      const { token } = await res.json();
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, loading: false, error: null });
      return true;
    } catch {
      set({ loading: false, error: 'Cannot connect to server' });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null });
  },
}));
