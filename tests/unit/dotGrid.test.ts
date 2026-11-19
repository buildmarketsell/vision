import { describe, expect, it } from 'vitest';
import { DOT_SPACING, dotGrid } from '../../src/features/board/dotGrid';

describe('dotGrid', () => {
  it('puts a dot on the board origin at 100%', () => {
    expect(dotGrid(0, 0, 1)).toEqual({ gap: DOT_SPACING, x: -DOT_SPACING / 2, y: -DOT_SPACING / 2 });
  });

  it('moves with the board and wraps negative scrolls', () => {
    const grid = dotGrid(-10, 30, 1);
    expect(grid.x + grid.gap / 2).toBe(DOT_SPACING - 10);
    expect(grid.y + grid.gap / 2).toBe(2);
  });

  it('scales the gap with zoom', () => {
    expect(dotGrid(0, 0, 2).gap).toBe(DOT_SPACING * 2);
  });

  it('skips dots when zoomed far out, keeping them on the same board points', () => {
    const grid = dotGrid(0, 0, 0.1);
    expect(grid.gap).toBeGreaterThanOrEqual(14);
    expect((grid.gap / 0.1) % DOT_SPACING).toBeCloseTo(0);
  });
});
