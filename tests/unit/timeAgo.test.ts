import { describe, expect, it } from 'vitest';
import { timeAgo } from '../../src/renderer/core/timeAgo';

const NOW = Date.UTC(2026, 10, 19, 12);
const ago = (minutes: number) => timeAgo(NOW - minutes * 60_000, NOW);

describe('timeAgo', () => {
  it('labels minutes, hours and days', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(5)).toBe('5 min ago');
    expect(ago(59)).toBe('59 min ago');
    expect(ago(60 * 3)).toBe('3 h ago');
    expect(ago(60 * 24 * 2)).toBe('2 d ago');
  });
});
