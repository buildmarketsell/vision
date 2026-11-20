import { describe, expect, it } from 'vitest';
import { DOT_SPACING, dotGrid } from '../../src/features/board/dotGrid';

describe('dotGrid', () => {
  it('puts a dot on the board origin at 100%, full strength', () => {
    expect(dotGrid(0, 0, 1)).toMatchObject({ gap: DOT_SPACING, x: 0, y: 0, fineAlpha: 1, alpha: 1 });
  });

  it('moves with the board and wraps negative scrolls onto a kept dot', () => {
    const grid = dotGrid(-10, 30, 1);
    expect(grid.x).toBe(DOT_SPACING * 2 - 10);
    expect(grid.y).toBe(30);
  });

  it('scales the gap with zoom', () => {
    expect(dotGrid(0, 0, 2).gap).toBe(DOT_SPACING * 2);
  });

  it('keeps dots on the same board points when zoomed far out', () => {
    const grid = dotGrid(0, 0, 0.1);
    expect(grid.gap).toBeGreaterThanOrEqual(12);
    expect((grid.gap / 0.1) % DOT_SPACING).toBeCloseTo(0);
  });

  it('fades the in-between dots smoothly instead of jumping when the gap doubles', () => {
    // Just above the doubling point the in-between dots are almost gone; just below, they are the full grid again.
    const above = dotGrid(0, 0, 12.01 / DOT_SPACING);
    const below = dotGrid(0, 0, 11.99 / DOT_SPACING);
    expect(above.fineAlpha).toBeLessThan(0.01);
    expect(below.gap).toBeCloseTo(above.gap * 2, 1);
    expect(below.fineAlpha).toBeGreaterThan(0.99);
  });

  it('makes dots smaller and lighter when zoomed out', () => {
    const near = dotGrid(0, 0, 1);
    const far = dotGrid(0, 0, 0.1);
    expect(far.radius).toBeLessThan(near.radius);
    expect(far.alpha).toBeLessThan(near.alpha);
  });
});
