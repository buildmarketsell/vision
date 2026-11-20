/** Dan's own colors on top of any theme (Settings → Colors): the accent and the chat box's neon. */

export interface CustomColors {
  /** Buttons, links, highlights, the working line. Null = the theme's own. */
  accent: string | null;
  /** The light that runs around the chat box. Null = follow the accent. */
  neon: string | null;
  neonOn: boolean;
}

export const DEFAULT_COLORS: CustomColors = { accent: null, neon: null, neonOn: true };

/** Ready-made choices; any other color comes from the Mac's color picker. */
export const COLOR_PRESETS = [
  { name: 'Orange', value: '#F26B3A' },
  { name: 'Pink', value: '#FF4FD8' },
  { name: 'Purple', value: '#A06BFF' },
  { name: 'Blue', value: '#3D8BFF' },
  { name: 'Cyan', value: '#22D3EE' },
  { name: 'Green', value: '#34D399' },
  { name: 'Yellow', value: '#FACC15' },
] as const;

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/** Whatever was saved, cleaned: anything that isn't a #rrggbb color falls back to the theme's. */
export function parseCustomColors(raw: unknown): CustomColors {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_COLORS;
  const value = raw as Record<string, unknown>;
  return {
    accent: isHexColor(value['accent']) ? value['accent'] : null,
    neon: isHexColor(value['neon']) ? value['neon'] : null,
    neonOn: value['neonOn'] !== false,
  };
}

/** Text that stays readable on a button of this color: near-black on light colors, white on dark ones (WCAG luminance). */
export function readableOn(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // White wins while it gives more contrast than black does.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#FFFFFF' : '#1C1A19';
}

/** The CSS variables a custom accent replaces; hover, soft fills and focus rings are mixed from it. */
export function accentVariables(accent: string): Record<string, string> {
  return {
    '--color-accent': accent,
    '--color-accent-hover': `color-mix(in oklab, ${accent} 85%, black)`,
    '--color-accent-soft': `color-mix(in srgb, ${accent} 14%, transparent)`,
    '--color-focus-ring': `color-mix(in srgb, ${accent} 45%, transparent)`,
    '--color-on-accent': readableOn(accent),
  };
}
