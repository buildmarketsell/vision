import { create } from 'zustand';
import type { ITheme } from '@xterm/xterm';
import { theme } from '../theme';

export type TerminalAppearance = 'dark' | 'light';

const STORAGE_KEY = 'vision.terminalAppearance';

/** Terminal colors per appearance. The CSS variables follow through `body[data-terminal-theme]` in terminal.css. */
export function xtermTheme(appearance: TerminalAppearance): ITheme {
  const { colors } = theme;
  const light = appearance === 'light';
  const background = light ? colors.terminalLightBackground : colors.terminalBackground;
  return {
    background,
    foreground: light ? colors.terminalLightText : colors.terminalText,
    cursor: colors.accent,
    cursorAccent: background,
    selectionBackground: '#F26B3A55',
    // xterm's default white and yellow vanish on a light background.
    ...(light ? { white: colors.terminalLightMuted, brightWhite: colors.terminalLightText, yellow: '#9A6B00', brightYellow: '#8A5F00' } : {}),
  };
}

function readStored(): TerminalAppearance {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyToPage(appearance: TerminalAppearance): void {
  document.body.dataset['terminalTheme'] = appearance;
}

interface TerminalThemeState {
  appearance: TerminalAppearance;
  setAppearance: (appearance: TerminalAppearance) => void;
  toggle: () => void;
}

/** Light or dark for every Claude terminal (and the chat's working card), remembered across launches. Set from the Claude panel and Settings. */
export const useTerminalTheme = create<TerminalThemeState>((set, get) => {
  const initial = readStored();
  applyToPage(initial);
  const setAppearance = (next: TerminalAppearance) => {
    applyToPage(next);
    set({ appearance: next });
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembering it is fine; it still switches.
    }
  };
  return {
    appearance: initial,
    setAppearance,
    toggle: () => setAppearance(get().appearance === 'dark' ? 'light' : 'dark'),
  };
});
