/**
 * Timing for the chat background effects, after Magic UI's Dot Pattern (glow) and Animated Grid Pattern.
 * Stateless: everything is worked out from the time, so nothing is stored per dot or square between frames.
 */

/** A steady pseudo-random number in [0, 1) for a pair of whole numbers. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** A dot pulses from 0.4 to full and back (scale 1 to 1.5), each with its own delay (0–5 s) and length (2–5 s). */
export function dotGlow(index: number, seconds: number): { opacity: number; scale: number } {
  const delay = hash(index, 1) * 5;
  const duration = 2 + hash(index, 2) * 3;
  const local = Math.max(0, seconds - delay);
  const level = Math.sin((Math.PI * local) / duration) ** 2;
  return { opacity: 0.4 + 0.6 * level, scale: 1 + 0.5 * level };
}

const FADE_S = 4;
const HOLD_S = 0.5;
/** One square's life: fade in, a short pause, fade out, then it moves to another cell. */
export const GRID_CYCLE_S = FADE_S * 2 + HOLD_S;
/** Squares start one after another, 0.1 s apart. */
const STAGGER_S = 0.1;

/** Where square `index` is and how lit it is (0–1) at this moment. */
export function gridSquare(index: number, seconds: number, cols: number, rows: number): { col: number; row: number; opacity: number } {
  const local = seconds - index * STAGGER_S;
  const cycle = Math.max(0, Math.floor(local / GRID_CYCLE_S));
  const phase = local - cycle * GRID_CYCLE_S;
  const opacity = local <= 0 ? 0 : phase < FADE_S ? smooth(phase / FADE_S) : phase < FADE_S + HOLD_S ? 1 : smooth(Math.max(0, GRID_CYCLE_S - phase) / FADE_S);
  return {
    col: Math.floor(hash(index, cycle * 2 + 7) * cols),
    row: Math.floor(hash(index, cycle * 2 + 8) * rows),
    opacity,
  };
}

/** The strips left and right of a centered column `clear` wide: only there is anything drawn. */
export function sideBands(width: number, clear: number): [number, number][] {
  const side = (width - clear) / 2;
  return side > 0 ? [[0, side], [width - side, width]] : [];
}

/**
 * The digital rain's symbols: the set from The Matrix sequels' titles, as listed by Rezmason's recreation
 * (github.com/Rezmason/matrix, MIT): katakana, digits without 6, a lone z and a few marks.
 */
export const MATRIX_GLYPHS = [...'モエヤキオカ7ケサスz152ヨタワ4ネヌナ98ヒ0ホア3ウセ¦:"꞊ミラリ╌ツテニハソ▪—<>|+*コシマムメ'];

/**
 * One cell of the digital rain, the film's way (after Rezmason): symbols stay put in a grid and drops of light
 * run down each column, a bright head with a fading trail. Each column has its own speed and spacing, so drops
 * in a column never catch each other. Symbols change now and then, each at its own pace.
 */
export function rainCell(col: number, row: number, seconds: number): { brightness: number; isHead: boolean; glyph: string } {
  const rowsPerSecond = 7 + hash(col, 11) * 9;
  const spacing = 28 + hash(col, 12) * 36;
  const lit = spacing * (0.45 + hash(col, 13) * 0.3);
  const head = seconds * rowsPerSecond + hash(col, 14) * spacing;
  const behind = (((head - row) % spacing) + spacing) % spacing;
  const isHead = behind < 1;
  const brightness = isHead ? 1 : behind < lit ? (1 - behind / lit) ** 1.4 : 0;

  const cell = col * 4099 + row;
  const changes = Math.floor(seconds * (0.3 + hash(cell, 15)) + hash(cell, 16) * 10);
  const glyph = MATRIX_GLYPHS[Math.floor(hash(cell, changes + 17) * MATRIX_GLYPHS.length)] ?? '0';
  return { brightness, isHead, glyph };
}
