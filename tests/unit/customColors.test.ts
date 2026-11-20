import { describe, expect, it } from 'vitest';
import { accentVariables, DEFAULT_COLORS, parseCustomColors, readableOn } from '../../src/shared/customColors';

describe('custom colors', () => {
  it('keeps only real #rrggbb colors from what was saved', () => {
    expect(parseCustomColors({ accent: '#22D3EE', neon: 'red', neonOn: false })).toEqual({ accent: '#22D3EE', neon: null, neonOn: false });
    expect(parseCustomColors({ accent: 'url(evil)' })).toEqual(DEFAULT_COLORS);
    expect(parseCustomColors(null)).toEqual(DEFAULT_COLORS);
  });

  it('puts dark text on light accents and white text on dark ones', () => {
    expect(readableOn('#FACC15')).toBe('#1C1A19');
    expect(readableOn('#22D3EE')).toBe('#1C1A19');
    expect(readableOn('#3D3BFF')).toBe('#FFFFFF');
    expect(readableOn('#000000')).toBe('#FFFFFF');
  });

  it('derives hover, soft fill and focus ring from the accent', () => {
    expect(accentVariables('#A06BFF')).toMatchObject({ '--color-accent': '#A06BFF', '--color-accent-soft': 'color-mix(in srgb, #A06BFF 14%, transparent)' });
  });
});
