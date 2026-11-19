import { describe, expect, it } from 'vitest';
import { rememberMacFonts } from '../../src/features/board/boardFonts';
import { BOARD_COLORS, DEFAULT_STYLE, DASHES, FILLS, FONTS, FONT_SIZES, NOTE_FILL, SIZES, fieldsToStyle, noteFill, styleToFields, tint, type BoardStyle } from '../../src/features/board/boardStyle';

describe('board styles (tldraw model on Excalidraw fields)', () => {
  it('tints toward white', () => {
    expect(tint('#000000', 0.5)).toBe('#808080');
    expect(tint('#4465e9', 0)).toBe('#4465e9');
    expect(tint('#4465e9', 1)).toBe('#ffffff');
  });

  it('maps draw dash to a rough line and the others to clean lines', () => {
    const base: BoardStyle = { color: 'blue', fill: 'none', dash: 'draw', size: 'm', font: 'sans', fontSize: 20 };
    expect(styleToFields(base)).toMatchObject({ roughness: 1, strokeStyle: 'solid', strokeColor: '#4465e9', backgroundColor: 'transparent' });
    expect(styleToFields({ ...base, dash: 'dotted' })).toMatchObject({ roughness: 0, strokeStyle: 'dotted' });
    expect(styleToFields({ ...base, fill: 'pattern' })).toMatchObject({ fillStyle: 'hachure', backgroundColor: '#4465e9' });
  });

  it('reads back every combination it writes, for shapes and text', () => {
    for (const { id: color } of BOARD_COLORS)
      for (const fill of FILLS)
        for (const dash of DASHES)
          for (const size of SIZES)
            for (const font of FONTS) {
              const style: BoardStyle = { color, fill, dash, size, font, fontSize: FONT_SIZES[size] };
              expect(fieldsToStyle(styleToFields(style))).toEqual(style);
              expect(fieldsToStyle(styleToFields(style), true)).toEqual(style);
            }
  });

  it('keeps any typed text size and any Mac font', () => {
    rememberMacFonts(['Avenir Next']);
    const style: BoardStyle = { color: 'black', fill: 'none', dash: 'solid', size: 'm', font: 'Avenir Next', fontSize: 57 };
    expect(fieldsToStyle(styleToFields(style), true)).toMatchObject({ font: 'Avenir Next', fontSize: 57 });
  });

  it('keeps any picked color, on shapes, fills and notes', () => {
    const style: BoardStyle = { ...DEFAULT_STYLE, color: '#12ab9f', fill: 'semi' };
    expect(styleToFields(style)).toMatchObject({ strokeColor: '#12ab9f' });
    expect(fieldsToStyle(styleToFields(style))).toMatchObject({ color: '#12ab9f', fill: 'semi' });
    expect(noteFill('#12ab9f')).toBe(tint('#12ab9f', 0.55));
  });

  it('falls back to defaults for colors and sizes it does not know', () => {
    expect(fieldsToStyle({ strokeColor: 'red', strokeWidth: 3 })).toMatchObject({ color: 'black', size: 'm' });
  });
});

describe('sticky notes', () => {
  it('use tldraw yellow by default and a light shade of any other color', () => {
    expect(noteFill('black')).toBe(NOTE_FILL);
    expect(noteFill('blue')).not.toBe(NOTE_FILL);
    expect(new Set(BOARD_COLORS.map(({ id }) => noteFill(id))).size).toBe(BOARD_COLORS.length);
  });
});
