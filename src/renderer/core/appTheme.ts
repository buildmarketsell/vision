import { create } from 'zustand';
import { applyThemeVariables } from '../theme';
import { themeById, type VisionTheme } from '../themes';

const STORAGE_KEY = 'vision.theme';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface AppThemeState {
  active: VisionTheme;
  setTheme: (id: string) => void;
}

/** The chosen theme, applied to the page as CSS variables and remembered across launches. */
export const useAppTheme = create<AppThemeState>((set) => {
  const initial = themeById(readStored());
  applyThemeVariables(document.documentElement, initial);
  window.vision.app.setScheme(initial.scheme);
  return {
    active: initial,
    setTheme: (id) => {
      const next = themeById(id);
      applyThemeVariables(document.documentElement, next);
      window.vision.app.setScheme(next.scheme);
      set({ active: next });
      try {
        localStorage.setItem(STORAGE_KEY, next.id);
      } catch {
        // Not remembering it is fine; it still switches.
      }
    },
  };
});

/** The active theme, for code outside React (terminal, editor setup). */
export function activeTheme(): VisionTheme {
  return useAppTheme.getState().active;
}
