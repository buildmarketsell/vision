import { useEffect, type RefObject } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { dotGrid, type DotGrid } from '../dotGrid';

function drawDots(canvas: HTMLCanvasElement, grid: DotGrid, color: string): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  // Hidden behind another page: nothing to draw; the resize observer redraws when it shows again.
  if (width === 0 || height === 0) return;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  const { gap, radius } = grid;
  // Start two gaps before the anchor so the first row and column are a kept ("coarse") dot.
  const startX = grid.x - gap * 2;
  const startY = grid.y - gap * 2;
  const columns = Math.ceil((width - startX) / gap) + 1;
  const rows = Math.ceil((height - startY) / gap) + 1;
  for (const coarse of [true, false]) {
    if (!coarse && grid.fineAlpha === 0) continue;
    context.globalAlpha = grid.alpha * (coarse ? 1 : grid.fineAlpha);
    context.beginPath();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if ((row % 2 === 0 && column % 2 === 0) !== coarse) continue;
        const x = startX + column * gap;
        const y = startY + row * gap;
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    context.fill();
  }
}

/**
 * Draws the dot grid on a canvas behind Excalidraw, in step with its scroll and zoom.
 * A canvas (not a CSS pattern) keeps every dot round and sharp at any zoom, as in FigJam.
 */
export function useDotGrid(api: ExcalidrawImperativeAPI | null, dots: RefObject<HTMLCanvasElement | null>, scheme: string) {
  useEffect(() => {
    const canvas = dots.current;
    if (!api || !canvas) return;
    const color = getComputedStyle(canvas).getPropertyValue('--color-board-dot').trim() || '#cbcbcb';
    let frame = 0;
    const draw = () => {
      frame = 0;
      const { scrollX, scrollY, zoom } = api.getAppState();
      drawDots(canvas, dotGrid(scrollX, scrollY, zoom.value), color);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    const unsubscribe = api.onScrollChange(schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      unsubscribe();
    };
  }, [api, dots, scheme]);
}
