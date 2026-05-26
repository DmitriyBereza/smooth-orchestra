/**
 * Zustand store for Cursor CLI availability state.
 * Updated by the socket listener when the server reports cursor availability.
 */
import { create } from 'zustand';

interface CursorState {
  /** Whether the Cursor CLI is available on the system. Defaults to false until checked. */
  cursorAvailable: boolean;
  setCursorAvailable: (available: boolean) => void;
}

export const useCursorStore = create<CursorState>((set) => ({
  cursorAvailable: false,
  setCursorAvailable: (available) => set({ cursorAvailable: available }),
}));
