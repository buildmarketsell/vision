/**
 * Conversions behind the board's color picker. HSV drives the picker (the square is saturation ×
 * brightness, the slider is hue); RGB and HSL are only for the typed fields. Boards store #rrggbb.
 */
export interface Hsv {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  v: number;
}
export type Rgb = [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** #rgb or #rrggbb, with or without the #, any case → #rrggbb; anything else → undefined. */
export function parseHex(text: string): string | undefined {
  const digits = text.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(digits)) return `#${[...digits].map((digit) => digit + digit).join('')}`;
  if (/^[0-9a-f]{6}$/.test(digits)) return `#${digits}`;
  return undefined;
}

export function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsv([r, g, b]: Rgb): Hsv {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta > 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

export const hexToHsv = (hex: string): Hsv => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv: Hsv): string => rgbToHex(hsvToRgb(hsv));

/** HSL as whole numbers: hue 0–360, saturation and lightness 0–100. */
export function rgbToHsl([r, g, b]: Rgb): Rgb {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const light = (max + min) / 2;
  const delta = max - min;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  return [Math.round(rgbToHsv([r, g, b]).h), Math.round(sat * 100), Math.round(light * 100)];
}

export function hslToRgb([h, s, l]: Rgb): Rgb {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const amount = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + clamp(h, 0, 360) / 30) % 12;
    return Math.round(255 * (light - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}
