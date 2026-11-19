import { describe, expect, it } from 'vitest';
import { fontFamilies, macFontId, macFontName, parseFontSize, rememberMacFonts } from '../../src/features/board/boardFonts';

describe('Mac fonts on boards', () => {
  it('gives each family a stable number above Excalidraw’s own', () => {
    expect(macFontId('Avenir Next')).toBe(macFontId('Avenir Next'));
    expect(macFontId('Avenir Next')).not.toBe(macFontId('Avenir'));
    expect(macFontId('Helvetica')).toBeGreaterThanOrEqual(10_000);
  });

  it('turns a saved number back into the font name once the Mac’s fonts are known', () => {
    expect(macFontName(macFontId('Georgia'))).toBeUndefined();
    rememberMacFonts(['Georgia']);
    expect(macFontName(macFontId('Georgia'))).toBe('Georgia');
  });

  it('lists each family once, A to Z', () => {
    expect(fontFamilies([{ family: 'Zapfino' }, { family: 'Arial' }, { family: 'Arial' }])).toEqual(['Arial', 'Zapfino']);
  });

  it('reads typed sizes and refuses unusable ones', () => {
    expect(parseFontSize('48')).toBe(48);
    expect(parseFontSize(' 13.25 ')).toBe(13.3);
    expect(parseFontSize('')).toBeNull();
    expect(parseFontSize('0')).toBeNull();
    expect(parseFontSize('1000')).toBeNull();
    expect(parseFontSize('abc')).toBeNull();
  });
});
