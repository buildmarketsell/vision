/**
 * Mac fonts on boards. Excalidraw stores a text's font as a number, so each font family gets a number
 * made from its name: the same font always gets the same number, on any Mac, and the saved file keeps it.
 */

/** Above Excalidraw's own font numbers (1-9, 100, 1000). */
const FIRST_ID = 10_000;
const ID_RANGE = 1_000_000_000;

const namesById = new Map<number, string>();

/** FNV-1a: a short, stable fingerprint of the name. */
export function macFontId(family: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < family.length; index++) {
    hash ^= family.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return FIRST_ID + (hash % ID_RANGE);
}

/** Remembers the Mac's font families, so a saved number can be shown as its name again. */
export function rememberMacFonts(families: readonly string[]): void {
  for (const family of families) namesById.set(macFontId(family), family);
}

export function macFontName(id: number | undefined): string | undefined {
  return id === undefined ? undefined : namesById.get(id);
}

/** Unique family names from the Mac's font list, A to Z. */
export function fontFamilies(fonts: readonly { family: string }[]): string[] {
  return [...new Set(fonts.map((font) => font.family))].sort((a, b) => a.localeCompare(b));
}

/** Text sizes Dan can type, in pixels at 100% zoom. */
export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 999;

/** A typed size, or null when it isn't a usable number. */
export function parseFontSize(text: string): number | null {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || text.trim() === '') return null;
  const rounded = Math.round(value * 10) / 10;
  return rounded < MIN_FONT_SIZE || rounded > MAX_FONT_SIZE ? null : rounded;
}
