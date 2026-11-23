import { describe, expect, it } from 'vitest';
import { islandPlacement } from '../../src/features/focus/main/islandPlacement';

const display = (width: number, height: number, menuBar: number, internal = true) => ({
  bounds: { x: 0, y: 0, width, height },
  workArea: { x: 0, y: menuBar, width, height: height - menuBar },
  internal,
});

describe('island placement', () => {
  it('finds the notch on a MacBook from its tall menu bar, and centers the island at the top', () => {
    expect(islandPlacement(display(1470, 956, 33), 460, 200)).toEqual({ bounds: { x: 505, y: 0, width: 460, height: 200 }, notch: true, menuBar: 33 });
  });

  it('finds the notch with the menu bar hidden, from the screen’s shape (notched screens are taller than 16:10)', () => {
    expect(islandPlacement(display(1512, 982, 0), 460, 200)).toMatchObject({ notch: true, menuBar: 38 });
  });

  it('sees no notch on a 16:10 MacBook or an external screen', () => {
    expect(islandPlacement(display(1440, 900, 24), 460, 200)).toMatchObject({ notch: false, menuBar: 24 });
    expect(islandPlacement(display(1440, 900, 0), 460, 200)).toMatchObject({ notch: false, menuBar: 24 });
    expect(islandPlacement(display(2560, 1440, 25, false), 460, 200)).toMatchObject({ notch: false, menuBar: 25 });
  });
});
