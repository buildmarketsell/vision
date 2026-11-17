import { describe, expect, it } from 'vitest';
import { BOARD_COLORS, DASHES, FILLS, FONTS, NOTE_FILL, SIZES, fieldsToStyle, noteFill, styleToFields, tint, type BoardStyle } from '../../src/features/board/boardStyle';

describe('board styles (tldraw model on Excalidraw fields)', () => {
  it('tints toward white', () => {
    expect(tint('#000000', 0.5)).toBe('#808080');
    expect(tint('#4465e9', 0)).toBe('#4465e9');
    expect(tint('#4465e9', 1)).toBe('#ffffff');
  });

  it('maps draw dash to a rough line and the others to clean lines', () => {
    const base: BoardStyle = { color: 'blue', fill: 'none', dash: 'draw', size: 'm', font: 'sans' };
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
              const style: BoardStyle = { color, fill, dash, size, font };
              expect(fieldsToStyle(styleToFields(style))).toEqual(style);
              expect(fieldsToStyle(styleToFields(style), true)).toEqual(style);
            }
  });

  it('falls back to defaults for colors and sizes it does not know', () => {
    expect(fieldsToStyle({ strokeColor: '#123456', strokeWidth: 3 })).toMatchObject({ color: 'black', size: 'm' });
  });
});

describe('sticky notes', () => {
  it('use tldraw yellow by default and a light shade of any other color', () => {
    expect(noteFill('black')).toBe(NOTE_FILL);
    expect(noteFill('blue')).not.toBe(NOTE_FILL);
    expect(new Set(BOARD_COLORS.map(({ id }) => noteFill(id))).size).toBe(BOARD_COLORS.length);
  });
});
