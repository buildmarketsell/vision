/*
 * Marching squares and elevation labels for the topo background.
 * Adapted from KokonutUI's "Topo Background" by @dorianbaffier (kokonutui.com), MIT licence.
 */

/** Distance between field samples, in CSS px. Contours are traced through this grid. */
export const CELL = 12;
/** Every fifth line is an index contour, drawn heavier, as on a real map. */
const INDEX_EVERY = 5;
/** At most one elevation label per slot of this size (px). Level n reads BASE + n * STEP metres. */
const LABEL_SPACING = 210;
const LABEL_BASE = 500;
const LABEL_STEP = 20;
/** Labels keep clear of the faded top and bottom edges. */
const LABEL_MARGIN = 0.16;
const MAX_LABEL_ANGLE = Math.PI / 3;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Label {
  x: number;
  y: number;
  angle: number;
  level: number;
  /** Squared distance to the slot's centre; the closest candidate wins. */
  score: number;
}

/** The best label spot found so far in each slot. */
export interface LabelSlots {
  drift: number;
  width: number;
  height: number;
  best: Map<number, Label>;
  /** Areas covered by content laid over the map, where a number would read as noise. */
  avoid: Rect[];
}

export function labelText(level: number): string {
  return `${LABEL_BASE + level * LABEL_STEP}`;
}

interface Crossings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The segment a contour draws through one cell, given which corners are above the level
 * (bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1) and where it crosses each edge.
 */
function cellSegments(path: Path2D, index: number, box: Rect, cross: Crossings): void {
  const { x0, y0, x1, y1 } = box;
  const { top, right, bottom, left } = cross;
  const line = (ax: number, ay: number, bx: number, by: number): void => {
    path.moveTo(ax, ay);
    path.lineTo(bx, by);
  };
  switch (index) {
    case 1:
    case 14:
      return line(x0, left, bottom, y1);
    case 2:
    case 13:
      return line(bottom, y1, x1, right);
    case 3:
    case 12:
      return line(x0, left, x1, right);
    case 4:
    case 11:
      return line(top, y0, x1, right);
    case 6:
    case 9:
      return line(top, y0, bottom, y1);
    case 7:
    case 8:
      return line(x0, left, top, y0);
    // Saddles: opposite corners are high, so the level crosses the cell twice.
    case 5:
      line(x0, left, top, y0);
      return line(bottom, y1, x1, right);
    case 10:
      line(top, y0, x1, right);
      return line(x0, left, bottom, y1);
    default:
      return undefined;
  }
}

/** Slots drift with the terrain and every other row is offset half a slot, so labels scatter. */
function offerLabel(slots: LabelSlots, label: Omit<Label, 'score'>): void {
  const { x, y } = label;
  const outside = y < slots.height * LABEL_MARGIN || y > slots.height * (1 - LABEL_MARGIN) || x < 24 || x > slots.width - 24;
  if (outside || slots.avoid.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)) return;
  const row = Math.floor(y / LABEL_SPACING);
  const shifted = x + slots.drift + (row % 2) * (LABEL_SPACING / 2);
  const col = Math.floor(shifted / LABEL_SPACING);
  const score = (shifted - (col + 0.5) * LABEL_SPACING) ** 2 + (y - (row + 0.5) * LABEL_SPACING) ** 2;
  // Too far from the slot centre: a neighbouring label could sit right next to it.
  if (score > (LABEL_SPACING * 0.32) ** 2) return;
  const key = row * 100_000 + col;
  const current = slots.best.get(key);
  if (!current || score < current.score) slots.best.set(key, { ...label, score });
}

/** Offers the point where an index contour crosses a cell, turned along the line and kept upright. */
function offerCellLabel(slots: LabelSlots, corners: [number, number, number, number], x0: number, y0: number, level: number, t: number): void {
  const [a, b, c, d] = corners;
  // The cell's gradient gives a steadier direction than the short segment itself.
  const gx = b - a + c - d;
  const gy = d - a + c - b;
  const px = gx / (2 * CELL);
  const py = gy / (2 * CELL);
  const g2 = px * px + py * py;
  const lift = g2 > 0 ? (t - (a + b + c + d) / 4) / g2 : 0;
  const half = CELL / 2;
  const ox = Math.max(-half, Math.min(half, lift * px));
  const oy = Math.max(-half, Math.min(half, lift * py));
  let angle = Math.atan2(gx, -gy);
  if (angle > Math.PI / 2) angle -= Math.PI;
  else if (angle < -Math.PI / 2) angle += Math.PI;
  // A number on its side is hard to read.
  if (Math.abs(angle) > MAX_LABEL_ANGLE) return;
  offerLabel(slots, { x: x0 + half + ox, y: y0 + half + oy, angle, level });
}

export interface ContourPaths {
  minor: Path2D;
  major: Path2D;
  slots: LabelSlots | null;
}

function traceCell(field: Float32Array, cols: number, i: number, j: number, interval: number, paths: ContourPaths): void {
  const a = field[j * cols + i] ?? 0;
  const b = field[j * cols + i + 1] ?? 0;
  const c = field[(j + 1) * cols + i + 1] ?? 0;
  const d = field[(j + 1) * cols + i] ?? 0;
  const first = Math.ceil(Math.min(a, b, c, d) / interval);
  const last = Math.floor(Math.max(a, b, c, d) / interval);
  const x0 = i * CELL;
  const y0 = j * CELL;
  const box = { x0, y0, x1: x0 + CELL, y1: y0 + CELL };
  for (let level = first; level <= last; level++) {
    const t = level * interval;
    const index = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
    if (index === 0 || index === 15) continue;
    const isIndex = level % INDEX_EVERY === 0;
    cellSegments(isIndex ? paths.major : paths.minor, index, box, {
      top: x0 + CELL * ((t - a) / (b - a)),
      right: y0 + CELL * ((t - b) / (c - b)),
      bottom: x0 + CELL * ((t - d) / (c - d)),
      left: y0 + CELL * ((t - a) / (d - a)),
    });
    // Saddles are poor label spots: the line turns sharply there.
    if (isIndex && paths.slots && index !== 5 && index !== 10) offerCellLabel(paths.slots, [a, b, c, d], x0, y0, level, t);
  }
}

/** Marching squares over the whole field; index contours go in their own path so each group is stroked once. */
export function traceContours(field: Float32Array, cols: number, rows: number, interval: number, paths: ContourPaths): void {
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) traceCell(field, cols, i, j, interval, paths);
  }
}
