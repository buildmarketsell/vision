/** Where the island goes and whether the screen has a notch. Pure, so it's unit tested with made-up screens. */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenInfo {
  bounds: Rect;
  workArea: Rect;
  internal: boolean;
}

/** Menu bars on MacBooks with a notch are taller (33–38 pt) than on other screens (24–25 pt). */
const NOTCH_MENU_BAR = 30;
/** Notched MacBook screens are a little taller than 16:10 (about 1.54 wide to 1 high; 16:10 is 1.6). */
const NOTCH_SHAPE = 1.58;
/** With the menu bar hidden there's nothing to measure: the notch's own height, and a plain menu bar's. */
const NOTCH_HEIGHT = 38;
const PLAIN_MENU_BAR = 24;

export function islandPlacement(screen: ScreenInfo, width: number, height: number): { bounds: Rect; notch: boolean; menuBar: number } {
  const measured = screen.workArea.y - screen.bounds.y;
  // The menu bar auto-hides: workArea then starts at the top, so fall back to the screen's shape.
  const notch = screen.internal && (measured >= NOTCH_MENU_BAR || (measured === 0 && screen.bounds.width / screen.bounds.height < NOTCH_SHAPE));
  return {
    bounds: { x: Math.round(screen.bounds.x + (screen.bounds.width - width) / 2), y: screen.bounds.y, width, height },
    notch,
    menuBar: measured > 0 ? measured : notch ? NOTCH_HEIGHT : PLAIN_MENU_BAR,
  };
}
