import { flushSync } from 'react-dom';
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
  /** `from`: where the click was; the new theme spreads from there in a blurred circle. */
  setTheme: (id: string, from?: { x: number; y: number }) => void;
}

/** The chosen theme, applied to the page as CSS variables and remembered across launches. */
export const useAppTheme = create<AppThemeState>((set) => {
  const initial = themeById(readStored());
  applyThemeVariables(document.documentElement, initial);
  window.vision.app.setScheme(initial.scheme);
  return {
    active: initial,
    setTheme: (id, from) => {
      const next = themeById(id);
      const apply = () => {
        applyThemeVariables(document.documentElement, next);
        window.vision.app.setScheme(next.scheme);
        flushSync(() => set({ active: next }));
      };
      try {
        localStorage.setItem(STORAGE_KEY, next.id);
      } catch {
        // Not remembering it is fine; it still switches.
      }
      revealTheme(apply, from);
    },
  };
});

/**
 * Switches with beui's circle blur: the new theme grows from the click in a circle that comes into
 * focus (styles/theme-reveal.css). Instant under reduced motion.
 */
function revealTheme(apply: () => void, from?: { x: number; y: number }): void {
  const root = document.documentElement;
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  root.style.setProperty('--theme-origin', from ? `${from.x}px ${from.y}px` : '50% 100%');
  root.dataset['themeReveal'] = '';
  void document.startViewTransition(apply).finished.finally(() => delete root.dataset['themeReveal']);
}

/** The active theme, for code outside React (terminal, editor setup). */
export function activeTheme(): VisionTheme {
  return useAppTheme.getState().active;
}
