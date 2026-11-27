import { useEffect, useRef } from 'react';
import { useChatBackdrop, type ChatBackdrop as Backdrop } from '../../../../renderer/core/chatBackdrop';
import { dotGlow, gridSquare, sideBands } from './backdropMath';
import { createDitherPainter } from './ditherPainter';
import { createMatrixPainter } from './matrixPainter';
import type { Painter } from './painter';

/** The chat column (760 px, chat.css) stays clear; the effect fades in beside it (mask in chat.css). */
const CLEAR = 760;
/** Plenty for slow effects, and half the work of the screen's 60. */
const FPS = 30;

const DOT_GAP = 16;
const GRID_CELL = 40;
const GRID_SQUARES = 50;
/** Magic UI's look: lines at 30%, squares lit up to half. */
const GRID_LINE_ALPHA = 0.3;
const GRID_SQUARE_ALPHA = 0.5;

/** Dots and grid on a plain 2D canvas, sharp at the screen's resolution. */
function create2dPainter(canvas: HTMLCanvasElement, kind: 'dots' | 'grid'): Painter | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return {
    draw: (seconds, width, height, clear, color) => {
      const scale = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      const bands = sideBands(width, clear);
      if (kind === 'dots') drawDots(ctx, bands, height, seconds);
      else drawGrid(ctx, bands, width, height, seconds);
    },
    dispose: () => undefined,
  };
}

/** Dot Pattern with glow: a 16 px grid of dots, each pulsing on its own. */
function drawDots(ctx: CanvasRenderingContext2D, bands: [number, number][], height: number, seconds: number): void {
  for (const [from, to] of bands) {
    for (let col = Math.floor(from / DOT_GAP); col * DOT_GAP < to; col += 1) {
      for (let row = 0; row * DOT_GAP < height; row += 1) {
        const { opacity, scale } = dotGlow(row * 1000 + col, seconds);
        ctx.globalAlpha = opacity * 0.8;
        ctx.beginPath();
        ctx.arc(col * DOT_GAP + 1, row * DOT_GAP + 1, scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Animated Grid Pattern: thin 40 px grid lines, squares fading in and out in random cells. Each side is laid out from its outer edge. */
function drawGrid(ctx: CanvasRenderingContext2D, bands: [number, number][], width: number, height: number, seconds: number): void {
  const [left] = bands;
  if (!left) return;
  const sideCols = Math.ceil(left[1] / GRID_CELL);
  const rows = Math.ceil(height / GRID_CELL);
  const cellX = (col: number) => (col < sideCols ? col * GRID_CELL : width - (col - sideCols + 1) * GRID_CELL);

  ctx.globalAlpha = GRID_LINE_ALPHA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 0; col <= sideCols; col += 1) {
    for (const x of [col * GRID_CELL + 0.5, width - col * GRID_CELL - 0.5]) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
  }
  for (let row = 0; row <= rows; row += 1) {
    ctx.moveTo(0, row * GRID_CELL + 0.5);
    ctx.lineTo(left[1], row * GRID_CELL + 0.5);
    ctx.moveTo(width - left[1], row * GRID_CELL + 0.5);
    ctx.lineTo(width, row * GRID_CELL + 0.5);
  }
  ctx.stroke();

  for (let index = 0; index < GRID_SQUARES; index += 1) {
    const { col, row, opacity } = gridSquare(index, seconds, sideCols * 2, rows);
    if (opacity <= 0) continue;
    ctx.globalAlpha = opacity * GRID_SQUARE_ALPHA;
    ctx.fillRect(cellX(col) + 1, row * GRID_CELL + 1, GRID_CELL - 1, GRID_CELL - 1);
  }
  ctx.globalAlpha = 1;
}

function createPainter(canvas: HTMLCanvasElement, backdrop: Exclude<Backdrop, 'off'>): Painter | null {
  if (backdrop === 'dither') return createDitherPainter(canvas) ?? create2dPainter(canvas, 'dots');
  if (backdrop === 'matrix') return createMatrixPainter(canvas);
  return create2dPainter(canvas, backdrop);
}

/**
 * The animation beside the Claude chat, picked in Settings. It only runs while the chat is on screen and VISION is the
 * front window; with Reduce Motion it draws one still frame.
 */
export function ChatBackdrop() {
  const backdrop = useChatBackdrop((state) => state.backdrop);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || backdrop === 'off') return;
    const painter = createPainter(canvas, backdrop);
    if (!painter) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colorVar = backdrop === 'dither' ? '--color-accent' : '--color-text-faint';
    const started = performance.now();
    let onScreen = false;
    let frame = 0;
    let lastDraw = 0;

    const draw = (now: number) => {
      const { clientWidth: width, clientHeight: height } = canvas;
      if (width === 0 || height === 0) return;
      // Read each frame so a theme switch shows at once; one style read is far cheaper than the drawing.
      const color = getComputedStyle(canvas).getPropertyValue(colorVar).trim() || 'gray';
      painter.draw(still ? 10 : (now - started) / 1000, width, height, CLEAR, color);
      lastDraw = now;
    };
    const loop = (now: number) => {
      frame = 0;
      if (!onScreen || document.hidden) return;
      if (now - lastDraw >= 1000 / FPS - 2) draw(now);
      frame = requestAnimationFrame(loop);
    };
    const resume = () => {
      if (still) draw(performance.now());
      else if (!frame) frame = requestAnimationFrame(loop);
    };

    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false;
      if (onScreen) resume();
    });
    visibility.observe(canvas);
    const resized = new ResizeObserver(() => still && onScreen && draw(performance.now()));
    resized.observe(canvas);
    document.addEventListener('visibilitychange', resume);

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resized.disconnect();
      document.removeEventListener('visibilitychange', resume);
      painter.dispose();
    };
  }, [backdrop]);

  if (backdrop === 'off') return null;
  // A new canvas per effect: a canvas that gave out a WebGL context can't give a 2D one.
  return <canvas key={backdrop} ref={canvasRef} className="chat-backdrop" data-backdrop={backdrop} aria-hidden />;
}
