import { describe, expect, it } from 'vitest';
import { dotGlow, gridSquare, GRID_CYCLE_S, sideBands } from '../../src/features/claude-terminal/renderer/chat/backdropMath';

describe('dotGlow', () => {
  it('pulses between 0.4 and 1 and grows up to 1.5x', () => {
    for (let t = 0; t < 20; t += 0.37) {
      const { opacity, scale } = dotGlow(7, t);
      expect(opacity).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(opacity).toBeLessThanOrEqual(1 + 1e-9);
      expect(scale).toBeCloseTo(1 + (opacity - 0.4) / 0.6 * 0.5);
    }
  });

  it('gives dots different rhythms', () => {
    expect(dotGlow(1, 3).opacity).not.toBeCloseTo(dotGlow(2, 3).opacity);
  });
});

describe('gridSquare', () => {
  it('fades in, out, then jumps to another cell', () => {
    const start = gridSquare(0, 0, 40, 30);
    expect(start.opacity).toBe(0);
    expect(gridSquare(0, 4, 40, 30).opacity).toBeCloseTo(1);
    expect(gridSquare(0, GRID_CYCLE_S - 0.01, 40, 30).opacity).toBeLessThan(0.01);
    const cells = new Set(Array.from({ length: 6 }, (_, cycle) => {
      const square = gridSquare(0, cycle * GRID_CYCLE_S + 1, 40, 30);
      return `${square.col},${square.row}`;
    }));
    expect(cells.size).toBeGreaterThan(1);
  });

  it('stays inside the grid and starts squares one after another', () => {
    for (let index = 0; index < 50; index += 1) {
      const square = gridSquare(index, 123.4, 12, 9);
      expect(square.col).toBeGreaterThanOrEqual(0);
      expect(square.col).toBeLessThan(12);
      expect(square.row).toBeGreaterThanOrEqual(0);
      expect(square.row).toBeLessThan(9);
    }
    expect(gridSquare(10, 0.5, 12, 9).opacity).toBe(0);
  });
});

describe('sideBands', () => {
  it('leaves the reading column empty and returns both sides', () => {
    expect(sideBands(1600, 1000)).toEqual([[0, 300], [1300, 1600]]);
  });

  it('returns nothing when there is no room beside the column', () => {
    expect(sideBands(900, 1000)).toEqual([]);
  });
});
