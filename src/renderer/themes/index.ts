import type { VisionTheme } from './types';
import { visionLight } from './visionLight';
import { catppuccinMocha } from './catppuccinMocha';

/** Every theme in the Settings picker, in this order. A new theme = a new file here and one entry below. */
export const THEMES: VisionTheme[] = [visionLight, catppuccinMocha];

export const DEFAULT_THEME = visionLight;

export function themeById(id: string | null): VisionTheme {
  return THEMES.find((item) => item.id === id) ?? DEFAULT_THEME;
}

export type { VisionTheme } from './types';
