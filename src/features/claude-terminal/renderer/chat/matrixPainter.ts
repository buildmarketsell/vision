import { MATRIX_GLYPHS, rainCell, sideBands } from './backdropMath';
import type { Painter } from './painter';

/**
 * The Matrix digital rain on black, as close to the film as a 2D canvas gets (after Rezmason's recreation):
 * green symbols with a glow, a pale bright head on each drop, katakana mirrored as in the film's code.
 */

/** About 80 columns across a laptop screen, like the film and Rezmason's default. */
const COL = 18;
const ROW = 21;
const FONT_SIZE = 17;
/** Room around each symbol for its glow. */
const PAD = 10;
const FONT = `${FONT_SIZE}px 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'SF Mono', monospace`;
const TRAIL = 'hsl(112 95% 58%)';
const HEAD = 'hsl(95 100% 88%)';
const GLOW = 'hsl(112 100% 45%)';
const KATAKANA = /[゠-ヿ]/;

/** Every symbol drawn once with its glow, in the trail and the head color; frames then only copy from it. */
function buildAtlas(scale: number): HTMLCanvasElement {
  const box = (COL + PAD * 2) * scale;
  const atlas = document.createElement('canvas');
  atlas.width = box * MATRIX_GLYPHS.length;
  atlas.height = box * 2;
  const ctx = atlas.getContext('2d');
  if (!ctx) return atlas;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  MATRIX_GLYPHS.forEach((glyph, index) => {
    [TRAIL, HEAD].forEach((color, line) => {
      ctx.save();
      ctx.translate(index * box + box / 2, line * box + box / 2);
      ctx.scale(KATAKANA.test(glyph) ? -scale : scale, scale);
      ctx.fillStyle = color;
      ctx.shadowColor = GLOW;
      ctx.shadowBlur = (line === 1 ? 14 : 7) * scale;
      ctx.fillText(glyph, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    });
  });
  return atlas;
}

export function createMatrixPainter(canvas: HTMLCanvasElement): Painter | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let atlas: HTMLCanvasElement | null = null;
  let atlasScale = 0;
  const glyphIndex = new Map(MATRIX_GLYPHS.map((glyph, index) => [glyph, index]));

  return {
    draw: (seconds, width, height, clear) => {
      const scale = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
      }
      if (!atlas || atlasScale !== scale) {
        atlas = buildAtlas(scale);
        atlasScale = scale;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const [left] = sideBands(width, clear);
      if (!left) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, left[1], height);
      ctx.fillRect(width - left[1], 0, left[1], height);

      const sideCols = Math.ceil(left[1] / COL);
      const rows = Math.ceil(height / ROW);
      const box = COL + PAD * 2;
      for (let col = 0; col < sideCols * 2; col += 1) {
        const x = col < sideCols ? col * COL : width - (col - sideCols + 1) * COL;
        for (let row = 0; row < rows; row += 1) {
          const { brightness, isHead, glyph } = rainCell(col, row, seconds);
          if (brightness < 0.03) continue;
          ctx.globalAlpha = brightness;
          const index = glyphIndex.get(glyph) ?? 0;
          ctx.drawImage(atlas, index * box * scale, (isHead ? box : 0) * scale, box * scale, box * scale, x - PAD, row * ROW - PAD + (ROW - COL) / 2, box, box);
        }
      }
      ctx.globalAlpha = 1;
    },
    dispose: () => undefined,
  };
}
