/** English formatting to match the rest of VISION (12.4K, 12,431), whatever the Mac's region. */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en-US');

/** 12.4K, 1.2M: for tiles and post cards. */
export const shortNumber = (value: number | null) => (value === null ? '–' : compact.format(value));
/** 12,431: for tooltips, where the exact number matters. */
export const fullNumber = (value: number) => full.format(value);

/** "+120", "−4", or null when there is nothing to compare yet. */
export function signed(value: number | null): string | null {
  if (value === null) return null;
  if (value === 0) return '±0';
  return `${value > 0 ? '+' : '−'}${compact.format(Math.abs(value))}`;
}

export const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
