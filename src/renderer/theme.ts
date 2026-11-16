/**
 * Every color, radius, spacing and font value in VISION. Change the look here.
 * The look: Notion's calm sidebar and page chrome on clonk-style floating cards.
 */
export const theme = {
  colors: {
    accent: '#F26B3A',
    accentHover: '#E35A28',
    accentSoft: 'rgba(242, 107, 58, 0.12)',
    windowBackground: '#E8EEF0',
    card: '#FFFFFF',
    sidebar: '#F7F7F5',
    text: '#37352F',
    textMuted: '#73726E',
    textFaint: '#A3A29E',
    rowHover: 'rgba(55, 53, 47, 0.06)',
    rowSelected: 'rgba(55, 53, 47, 0.09)',
    border: 'rgba(0, 0, 0, 0.06)',
    danger: '#D44C47',
    dangerSoft: 'rgba(212, 76, 71, 0.1)',
    warningSoft: 'rgba(242, 107, 58, 0.1)',
    terminalBackground: '#1C1A19',
    terminalText: '#ECE9E4',
    terminalMuted: '#8F8A84',
    focusRing: 'rgba(242, 107, 58, 0.45)',
  },
  radius: {
    card: '16px',
    inner: '12px',
    control: '8px',
    row: '6px',
    pill: '999px',
  },
  /** Spacing scale in px. Use only these. */
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px' },
  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 28px rgba(15, 23, 42, 0.10)',
    popover: '0 4px 16px rgba(15, 23, 42, 0.14)',
  },
  font: {
    ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
    sizeSmall: '12px',
    sizeBase: '14px',
    sizeTitle: '15px',
    sizeTerminal: 13,
    sizeEditor: 14,
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
  root.style.setProperty('--title-bar-height', theme.layout.titleBarHeight);
}
