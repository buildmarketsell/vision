import { describe, expect, it } from 'vitest';
import { hexToHsv, hexToRgb, hslToRgb, hsvToHex, parseHex, rgbToHex, rgbToHsl } from '../../src/features/board/colorMath';

describe('board color picker math', () => {
  it('reads typed hex in any common form and rejects the rest', () => {
    expect(parseHex('#12AB9F')).toBe('#12ab9f');
    expect(parseHex('12ab9f')).toBe('#12ab9f');
    expect(parseHex('#f0a')).toBe('#ff00aa');
    expect(parseHex(' #FFF ')).toBe('#ffffff');
    expect(parseHex('#12ab9')).toBeUndefined();
    expect(parseHex('#gggggg')).toBeUndefined();
    expect(parseHex('')).toBeUndefined();
  });

  it('converts between hex and the picker (HSV) without drifting', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 0.5, v: 1 })).toBe('#8080ff');
    for (const hex of ['#3478f6', '#12ab9f', '#ffffff', '#7f7f7f', '#e03131', '#fcc419']) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });

  it('converts RGB and HSL for the typed fields', () => {
    expect(hexToRgb('#3478f6')).toEqual([52, 120, 246]);
    expect(rgbToHex([300, -4, 15.6])).toBe('#ff0010');
    expect(rgbToHsl([255, 0, 0])).toEqual([0, 100, 50]);
    expect(rgbToHsl([255, 255, 255])).toEqual([0, 0, 100]);
    expect(hslToRgb([0, 100, 50])).toEqual([255, 0, 0]);
    expect(hslToRgb([210, 50, 40])).toEqual([51, 102, 153]);
    expect(rgbToHsl([51, 102, 153])).toEqual([210, 50, 40]);
  });
});
