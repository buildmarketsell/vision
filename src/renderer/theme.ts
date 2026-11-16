/**
 * Every color, radius, spacing and font value in VISION. Change the look here.
 * The look: Notion's calm sidebar and page chrome on clonk-style floating cards.
 */
export const theme = {
  colors: {
    accent: '#F26B3A',
    /** Claude's own orange, for the Claude logo. */
    claude: '#D97757',
    accentHover: '#E35A28',
    accentSoft: 'rgba(242, 107, 58, 0.12)',
    windowBackground: '#E8EEF0',
    card: '#FFFFFF',
    sidebar: '#F7F7F5',
    text: '#37352F',
    textMuted: '#6E6D69',
    /** Small labels: still 4.5:1 on the sidebar. */
    textFaint: '#8A8985',
    rowHover: 'rgba(55, 53, 47, 0.06)',
    rowPressed: 'rgba(55, 53, 47, 0.11)',
    rowSelected: 'rgba(55, 53, 47, 0.09)',
    border: 'rgba(0, 0, 0, 0.06)',
    danger: '#D44C47',
    success: '#2F7D5B',
    diffAddedBackground: 'rgba(47, 125, 91, 0.10)',
    diffRemovedBackground: 'rgba(212, 76, 71, 0.10)',
    codeBackground: '#F7F6F3',
    dangerSoft: 'rgba(212, 76, 71, 0.1)',
    warningSoft: 'rgba(242, 107, 58, 0.1)',
    terminalBackground: '#1C1A19',
    terminalText: '#ECE9E4',
    terminalMuted: '#8F8A84',
    focusRing: 'rgba(242, 107, 58, 0.45)',
  },
  radius: {
    card: '16px',
    /** Concentric with the card: card radius minus the 8px inset. */
    inner: '8px',
    control: '8px',
    row: '6px',
    pill: '999px',
  },
  /** Spacing scale in px. Use only these. */
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px' },
  /** Bigger surfaces read as further away: deeper, softer shadows. */
  shadow: {
    card: '0 0 0 0.5px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.12)',
    control: '0 0 0 0.5px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.06)',
    popover: '0 0 0 0.5px rgba(15, 23, 42, 0.08), 0 8px 24px rgba(15, 23, 42, 0.16)',
  },
  font: {
    /** San Francisco: macOS's own font, with optical sizing and size-specific tracking built in. */
    ui: "system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    mono: "'SF Mono', Menlo, Monaco, monospace",
    sizeSmall: '11px',
    sizeBase: '13px',
    sizeTitle: '14px',
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
    gap: 8,
    sidebarDefaultWidth: 260,
    sidebarMinWidth: 200,
    sidebarMaxWidth: 480,
    titleBarHeight: '44px',
  },
} as const;

/** Exposes the tokens as CSS variables (`--color-accent`, `--radius-card`, …) for styles.css. */
export function applyThemeVariables(root: HTMLElement): void {
  const groups: Record<string, Record<string, string | number>> = {
    color: theme.colors,
    radius: theme.radius,
    space: theme.space,
    shadow: theme.shadow,
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
  root.style.setProperty('--gap', `${theme.layout.gap}px`);
  root.style.setProperty('--ease', theme.motion.ease);
  root.style.setProperty('--duration-fast', theme.motion.fast);
  root.style.setProperty('--duration-base', theme.motion.base);
  root.style.setProperty('--title-bar-height', theme.layout.titleBarHeight);
}
