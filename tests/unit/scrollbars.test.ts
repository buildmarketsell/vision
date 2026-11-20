import { describe, expect, it } from 'vitest';
import { isOnScrollbar } from '../../src/renderer/core/scrollbars';

describe('scrollbar hover', () => {
  const box = { left: 0, top: 0, right: 200, bottom: 100, barWidth: 10, barHeight: 0 };
  it('is on the bar only inside its gutter', () => {
    expect(isOnScrollbar(box, 195, 50)).toBe(true);
    expect(isOnScrollbar(box, 189, 50)).toBe(false);
    expect(isOnScrollbar(box, 205, 50)).toBe(false);
    expect(isOnScrollbar(box, 195, 120)).toBe(false);
  });
  it('finds the horizontal bar, and nothing when there is no bar', () => {
    expect(isOnScrollbar({ ...box, barWidth: 0, barHeight: 10 }, 50, 95)).toBe(true);
    expect(isOnScrollbar({ ...box, barWidth: 0 }, 199, 50)).toBe(false);
  });
});
