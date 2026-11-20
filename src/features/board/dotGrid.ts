/**
 * FigJam's dot grid, drawn behind the board and moved with it so it scrolls and zooms with the drawing.
 * Zooming out, dots get smaller and lighter, and every other dot fades away before it would crowd
 * the screen, so the grid never jumps or turns into a haze.
 */

/** Board units between dots at 100%. */
export const DOT_SPACING = 24;
/** Screen pixels: dots closer than this are half-faded; at this gap the in-between dots are gone. */
const MIN_SCREEN_GAP = 12;

export interface DotGrid {
  /** Screen pixels between dots. */
  gap: number;
  /** Screen position of one dot; the rest are whole gaps away from it. */
  x: number;
  y: number;
  /** Opacity of the in-between dots (1 = as strong as the rest, 0 = gone). Every other dot is always full. */
  fineAlpha: number;
  /** Dot radius in screen pixels. */
  radius: number;
  /** Opacity of the whole grid: lighter when zoomed far out. */
  alpha: number;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Excalidraw puts board point p on screen at (p + scroll) * zoom, so dots on board multiples of the spacing land here. */
export function dotGrid(scrollX: number, scrollY: number, zoom: number): DotGrid {
  let gap = DOT_SPACING * zoom;
  while (gap < MIN_SCREEN_GAP) gap *= 2;
  // Dots at even steps of `gap` are the "coarse" ones that stay; anchor on one of them.
  const coarse = gap * 2;
  return {
    gap,
    x: wrap(scrollX * zoom, coarse),
    y: wrap(scrollY * zoom, coarse),
    fineAlpha: clamp((gap - MIN_SCREEN_GAP) / MIN_SCREEN_GAP, 0, 1),
    radius: clamp(0.6 + 0.5 * zoom, 0.6, 1.4),
    alpha: clamp(0.6 + zoom, 0.6, 1),
  };
}
