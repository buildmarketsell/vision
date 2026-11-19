/**
 * tldraw's style model (color, fill, dash, size, font) mapped onto Excalidraw element fields.
 * Pure, so it is unit tested without Excalidraw.
 *
 * The colors here are drawing colors saved inside board files, not app chrome, so they are
 * fixed values rather than theme tokens (Excalidraw inverts the canvas itself in dark mode).
 */

/** tldraw's palette, in its order (4 columns × 3 rows). */
import { macFontId, macFontName } from './boardFonts';

export const BOARD_COLORS = [
  { id: 'black', hex: '#1d1d1d' },
  { id: 'grey', hex: '#9fa8b2' },
  { id: 'light-violet', hex: '#e085f4' },
  { id: 'violet', hex: '#ae3ec9' },
  { id: 'blue', hex: '#4465e9' },
  { id: 'light-blue', hex: '#4ba1f1' },
  { id: 'yellow', hex: '#f1ac4b' },
  { id: 'orange', hex: '#e16919' },
  { id: 'green', hex: '#099268' },
  { id: 'light-green', hex: '#4cb05e' },
  { id: 'light-red', hex: '#f87777' },
  { id: 'red', hex: '#e03131' },
] as const;

/** See-through, so the theme's dot grid behind the canvas shows (board.css). */
export const CANVAS_BACKGROUND = 'transparent';
export const SELECTION_BLUE = '#2f80ed';
export const NOTE_FILL = '#ffe589';
export const NOTE_TEXT = '#1d1d1d';

export type BoardColor = (typeof BOARD_COLORS)[number]['id'];
export type Fill = 'none' | 'semi' | 'solid' | 'pattern';
export type Dash = 'draw' | 'solid' | 'dashed' | 'dotted';
export type Size = 's' | 'm' | 'l' | 'xl';
/** Excalidraw's three fonts; any other font is a Mac font family name. */
export type BuiltInFont = 'draw' | 'sans' | 'mono';

export interface BoardStyle {
  /** One of the 12 board colors, or any #rrggbb picked in the Mac's color panel. */
  color: BoardColor | string;
  fill: Fill;
  dash: Dash;
  size: Size;
  /** A built-in font or the family name of any font on the Mac. */
  font: string;
  /** Text size in pixels: S-XL pick one, or any typed number. */
  fontSize: number;
}

export const DEFAULT_STYLE: BoardStyle = { color: 'black', fill: 'none', dash: 'solid', size: 'm', font: 'sans', fontSize: 20 };

export const FILLS: Fill[] = ['none', 'semi', 'solid', 'pattern'];
export const DASHES: Dash[] = ['draw', 'solid', 'dashed', 'dotted'];
export const SIZES: Size[] = ['s', 'm', 'l', 'xl'];
export const FONTS: BuiltInFont[] = ['draw', 'sans', 'mono'];

/** Excalidraw's font ids (FONT_FAMILY): Excalifont, Nunito, Cascadia. */
const FONT_IDS: Record<BuiltInFont, number> = { draw: 5, sans: 6, mono: 3 };
const STROKE_WIDTHS: Record<Size, number> = { s: 1, m: 2, l: 4, xl: 6 };
export const FONT_SIZES: Record<Size, number> = { s: 16, m: 20, l: 28, xl: 36 };

const HEX = /^#[0-9a-f]{6}$/i;

export function hexOf(color: string): string {
  if (HEX.test(color)) return color.toLowerCase();
  return BOARD_COLORS.find((entry) => entry.id === color)?.hex ?? BOARD_COLORS[0].hex;
}

/** Mixes a #rrggbb color with white; amount 0 = unchanged, 1 = white. */
export function tint(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `#${channels.map((value) => Math.round(value + (255 - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/** A sticky note's paper: tldraw's yellow for the default color, otherwise a light shade of the color. */
export function noteFill(color: string): string {
  return color === DEFAULT_STYLE.color ? NOTE_FILL : tint(hexOf(color), 0.55);
}

/** The Excalidraw fields a style sets, for shapes and for text. */
export interface ElementStyleFields {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'solid' | 'hachure';
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  strokeWidth: number;
  fontSize: number;
  fontFamily: number;
}

export function styleToFields(style: BoardStyle): ElementStyleFields {
  const stroke = hexOf(style.color);
  const backgrounds: Record<Fill, string> = { none: 'transparent', semi: tint(stroke, 0.88), solid: tint(stroke, 0.6), pattern: stroke };
  return {
    strokeColor: stroke,
    backgroundColor: backgrounds[style.fill],
    fillStyle: style.fill === 'pattern' ? 'hachure' : 'solid',
    strokeStyle: style.dash === 'draw' ? 'solid' : style.dash,
    roughness: style.dash === 'draw' ? 1 : 0,
    strokeWidth: STROKE_WIDTHS[style.size],
    fontSize: style.fontSize,
    fontFamily: FONT_IDS[style.font as BuiltInFont] ?? macFontId(style.font),
  };
}

/** The style panel's view of an element (or of Excalidraw's "current item" settings). */
export function fieldsToStyle(fields: Partial<ElementStyleFields>, isText = false): BoardStyle {
  const stroke = (fields.strokeColor ?? '').toLowerCase();
  const color = BOARD_COLORS.find((entry) => entry.hex === stroke)?.id ?? (HEX.test(stroke) ? stroke : DEFAULT_STYLE.color);
  const background = (fields.backgroundColor ?? 'transparent').toLowerCase();
  let fill: Fill = 'none';
  if (fields.fillStyle && fields.fillStyle !== 'solid' && background !== 'transparent') fill = 'pattern';
  else if (background === tint(hexOf(color), 0.88)) fill = 'semi';
  else if (background !== 'transparent') fill = 'solid';
  const dash: Dash = (fields.roughness ?? 0) > 0 ? 'draw' : (fields.strokeStyle ?? 'solid');
  const sizes = isText ? FONT_SIZES : STROKE_WIDTHS;
  const value = isText ? fields.fontSize : fields.strokeWidth;
  const size = SIZES.reduce((best, candidate) => (Math.abs(sizes[candidate] - (value ?? 0)) < Math.abs(sizes[best] - (value ?? 0)) ? candidate : best), DEFAULT_STYLE.size);
  const font = FONTS.find((candidate) => FONT_IDS[candidate] === fields.fontFamily) ?? macFontName(fields.fontFamily) ?? DEFAULT_STYLE.font;
  return { color, fill, dash, size, font, fontSize: fields.fontSize ?? DEFAULT_STYLE.fontSize };
}

/** Excalidraw's "current item" settings for a style, so new shapes use it. */
export function styleToCurrentItem(style: BoardStyle) {
  const fields = styleToFields(style);
  return {
    currentItemStrokeColor: fields.strokeColor,
    currentItemBackgroundColor: fields.backgroundColor,
    currentItemFillStyle: fields.fillStyle,
    currentItemStrokeStyle: fields.strokeStyle,
    currentItemRoughness: fields.roughness,
    currentItemStrokeWidth: fields.strokeWidth,
    currentItemFontSize: fields.fontSize,
    currentItemFontFamily: fields.fontFamily,
  };
}
