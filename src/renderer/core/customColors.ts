import { create } from 'zustand';
import { accentVariables, DEFAULT_COLORS, parseCustomColors, type CustomColors } from '../../shared/customColors';

const STORAGE_KEY = 'vision.colors';
const ACCENT_KEYS = Object.keys(accentVariables('#000000'));

function readStored(): CustomColors {
  try {
    return parseCustomColors(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_COLORS;
  }
}

/**
 * Set on <body>, not <html>: the theme writes its variables on <html>, so these win inside the page
 * and survive switching themes.
 */
function applyToPage(colors: CustomColors): void {
  const style = document.body.style;
  for (const key of ACCENT_KEYS) style.removeProperty(key);
  if (colors.accent) for (const [key, value] of Object.entries(accentVariables(colors.accent))) style.setProperty(key, value);
  style.setProperty('--color-neon', colors.neon ?? 'var(--color-accent)');
  document.body.dataset['neon'] = colors.neonOn ? 'on' : 'off';
}

interface CustomColorsState extends CustomColors {
  update: (change: Partial<CustomColors>) => void;
}

/** Dan's accent and neon colors, applied over the theme and remembered across launches. */
export const useCustomColors = create<CustomColorsState>((set, get) => {
  const initial = readStored();
  applyToPage(initial);
  return {
    ...initial,
    update: (change) => {
      const { accent, neon, neonOn } = { ...get(), ...change };
      const next = parseCustomColors({ accent, neon, neonOn });
      applyToPage(next);
      set(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not remembering it is fine; it still changes now.
      }
    },
  };
});
