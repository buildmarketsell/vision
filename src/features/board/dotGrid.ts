/** Freeform's dot grid, drawn behind the board and moved with it so it scrolls and zooms with the drawing. */

/** Board units between dots at 100%. */
export const DOT_SPACING = 28;
/** Screen pixels: zoomed out further than this, every other dot is skipped so the grid never turns into a haze. */
const MIN_SCREEN_GAP = 14;

export interface DotGrid {
  /** Screen pixels between dots. */
  gap: number;
  /** Where the dot tiles start, as a CSS background-position (each dot sits in the middle of its tile). */
  x: number;
  y: number;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** Excalidraw puts board point p on screen at (p + scroll) * zoom, so dots on board multiples of the spacing land here. */
export function dotGrid(scrollX: number, scrollY: number, zoom: number): DotGrid {
  let gap = DOT_SPACING * zoom;
  while (gap < MIN_SCREEN_GAP) gap *= 2;
  return { gap, x: wrap(scrollX * zoom, gap) - gap / 2, y: wrap(scrollY * zoom, gap) - gap / 2 };
}
