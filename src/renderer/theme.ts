import type { VisionTheme } from './themes/types';

/**
 * Radius, spacing, font and motion values shared by every theme. Colors, shadows and syntax colors
 * live in one file per theme in `themes/` (listed in `themes/index.ts`).
 */
export const theme = {
  radius: {
    card: '16px',
    /** Concentric with a card: card radius minus an 8px inset. */
    inner: '8px',
    control: '8px',
    row: '6px',
    pill: '999px',
  },
  /** Spacing scale in px. Use only these. */
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px' },
  font: {
    /** Notion's font stack (San Francisco on a Mac), chosen by Dan 2026-11-17. */
    ui: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Display', 'Segoe UI', Helvetica, 'Apple Color Emoji', Arial, sans-serif",
    mono: "'SF Mono', Menlo, Monaco, monospace",
    /** Notion's sizes: 12 for captions, 14 for controls (its sidebar), 16 for reading (its pages). */
    sizeSmall: '12px',
    sizeBase: '14px',
    sizeTitle: '15px',
    sizeReading: '16px',
    sizeTerminal: 12.5,
    sizeEditor: 13,
  },
  /** Motion: critically damped (no overshoot) ease, Apple's default for UI that wasn't flicked. */
  motion: {
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
    fast: '120ms',
    base: '200ms',
  },
  layout: {
    /** The feature menu on the left; fixed, like Notion's. */
    menuWidth: '220px',
    sidebarDefaultWidth: 260,
    sidebarMinWidth: 200,
    sidebarMaxWidth: 480,
    /** Sidebar top row and tab strip share this height, so they line up. */
    titleBarHeight: '36px',
    /** Top-left room for the traffic lights and the sidebar button; the strip starts after it when the sidebar is hidden. */
    titleBarInset: '112px',
    /** Top-right room for the sidebar button when the sidebar is hidden. */
    titleBarInsetRight: '44px',
    tabWidth: '240px',
    tabMinWidth: '96px',
  },
} as const;

/** Exposes the shared tokens and the active theme's as CSS variables (`--color-accent`, `--radius-card`, …) for styles.css. */
export function applyThemeVariables(root: HTMLElement, active: VisionTheme): void {
  const groups: Record<string, Record<string, string | number>> = {
    color: active.colors,
    radius: theme.radius,
    space: theme.space,
    shadow: active.shadow,
  };
  for (const [prefix, values] of Object.entries(groups)) {
    for (const [name, value] of Object.entries(values)) {
      const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      root.style.setProperty(`--${prefix}-${kebab}`, String(value));
    }
  }
  root.style.setProperty('--font-ui', theme.font.ui);
  root.style.setProperty('--font-mono', theme.font.mono);
  root.style.setProperty('--size-small', theme.font.sizeSmall);
  root.style.setProperty('--size-base', theme.font.sizeBase);
  root.style.setProperty('--size-title', theme.font.sizeTitle);
  root.style.setProperty('--size-reading', theme.font.sizeReading);
  root.style.setProperty('--ease', theme.motion.ease);
  root.style.setProperty('--duration-fast', theme.motion.fast);
  root.style.setProperty('--duration-base', theme.motion.base);
  root.style.setProperty('--title-bar-height', theme.layout.titleBarHeight);
  root.style.setProperty('--title-bar-inset', theme.layout.titleBarInset);
  root.style.setProperty('--title-bar-inset-right', theme.layout.titleBarInsetRight);
  root.style.setProperty('--menu-width', theme.layout.menuWidth);
  root.style.setProperty('--tab-width', theme.layout.tabWidth);
  root.style.setProperty('--tab-min-width', theme.layout.tabMinWidth);
  // Native scrollbars, form controls and the default selection follow the theme.
  root.style.setProperty('color-scheme', active.scheme);
  root.dataset['scheme'] = active.scheme;
}
