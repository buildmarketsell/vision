import { describe, expect, it } from 'vitest';
import { dotGlow, gridSquare, GRID_CYCLE_S, MATRIX_GLYPHS, rainCell, sideBands } from '../../src/features/claude-terminal/renderer/chat/backdropMath';

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

describe('rainCell', () => {
  const column = 3;
  /** Brightness down one column at one moment. */
  const columnAt = (seconds: number) => Array.from({ length: 60 }, (_, row) => rainCell(column, row, seconds));

  it('has a brightest head with a trail fading above it and darkness below', () => {
    const cells = columnAt(12.3);
    const head = cells.findIndex((cell) => cell.isHead);
    expect(head).toBeGreaterThan(0);
    expect(cells[head]?.brightness).toBe(1);
    const above = cells[head - 1]?.brightness ?? 0;
    expect(above).toBeGreaterThan(0);
    expect(above).toBeLessThan(1);
    if (head + 1 < cells.length) expect(cells[head + 1]?.brightness).toBe(0);
  });

  it('falls: the head moves down over time', () => {
    const headAt = (seconds: number) => columnAt(seconds).findIndex((cell) => cell.isHead);
    const first = headAt(12.3);
    expect(headAt(12.6)).toBeGreaterThan(first);
  });

  it('uses the film glyphs and changes them slowly', () => {
    const glyphs = Array.from({ length: 40 }, (_, step) => rainCell(5, 7, step * 0.5).glyph);
    expect(glyphs.every((glyph) => MATRIX_GLYPHS.includes(glyph))).toBe(true);
    expect(new Set(glyphs).size).toBeGreaterThan(1);
    expect(rainCell(5, 7, 1).glyph).toBe(rainCell(5, 7, 1.02).glyph);
  });
});
