import { useEffect, useState } from 'react';
import { FONT_FAMILY } from '@excalidraw/excalidraw';
import { fontFamilies, macFontId, rememberMacFonts } from '../boardFonts';

interface LocalFont {
  family: string;
}
type FontQuery = () => Promise<LocalFont[]>;

export interface MacFonts {
  families: string[];
  error: string | null;
}

let loading: Promise<MacFonts> | null = null;

/**
 * Lists the Mac's fonts once (Chromium's Local Font Access) and teaches them to Excalidraw.
 * Excalidraw turns a font number into a CSS font name by searching its FONT_FAMILY table, so adding
 * entries there is all it needs to draw, measure and edit text in any installed font.
 */
export function loadMacFonts(): Promise<MacFonts> {
  loading ??= (async () => {
    try {
      const query = (window as unknown as { queryLocalFonts?: FontQuery }).queryLocalFonts;
      if (!query) return { families: [], error: 'This version of VISION cannot list the Mac’s fonts.' };
      const families = fontFamilies(await query());
      const table = FONT_FAMILY as Record<string, number>;
      // Quoted, so names with digits or symbols still make a valid CSS font.
      for (const family of families) table[`"${family.replace(/"/g, '')}"`] = macFontId(family);
      rememberMacFonts(families);
      return { families, error: null };
    } catch (error) {
      return { families: [], error: `The Mac’s fonts could not be listed: ${String(error)}` };
    }
  })();
  return loading;
}

/** The Mac's fonts, or null while they're being listed (boards wait, so saved fonts draw right the first time). */
export function useMacFonts(): MacFonts | null {
  const [fonts, setFonts] = useState<MacFonts | null>(null);
  useEffect(() => {
    let active = true;
    void loadMacFonts().then((result) => active && setFonts(result));
    return () => {
      active = false;
    };
  }, []);
  return fonts;
}
