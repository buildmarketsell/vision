/*
 * Draws the topo background on a canvas and keeps it moving.
 * Adapted from KokonutUI's "Topo Background" by @dorianbaffier (kokonutui.com), MIT licence.
 */
import { CELL, labelText, traceContours, type LabelSlots } from './contours';
import { createSampler, RIPPLE_MS, stepHill, type Hill, type Ripple } from './topoField';

/** Height difference between two contour lines. */
const INTERVAL = 0.07;
const SEED = 26;
/** When nothing moves but the drift, a frame every 33 ms is plenty. */
const IDLE_FRAME_MS = 33;
const LABEL_FONT = '500 10px -apple-system, system-ui, sans-serif';

/** Knocks the lines out under each label, then prints the elevation, as on a survey map. */
function drawLabels(ctx: CanvasRenderingContext2D, slots: LabelSlots): void {
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const label of slots.best.values()) {
    const text = labelText(label.level);
    const w = ctx.measureText(text).width + 8;
    ctx.save();
    ctx.translate(Math.round(label.x), Math.round(label.y));
    ctx.rotate(label.angle);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillRect(-w / 2, -6, w, 12);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.5;
    ctx.fillText(text, 0, 0.5);
    ctx.restore();
  }
}

/**
 * Starts the map on `canvas` (stroked in the canvas's CSS `color`). Content inside `root` other than
 * the canvas is kept free of labels. Returns a function that stops everything.
 */
export function startTopo(root: HTMLElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sample = createSampler(SEED);
  const hill: Hill = { x: 0, y: 0, targetX: 0, targetY: 0, amount: 0, on: false };
  const ripples: Ripple[] = [];
  const slots: LabelSlots = { drift: 0, width: 0, height: 0, best: new Map(), avoid: [] };
  let field = new Float32Array(0);
  let cols = 0;
  let rows = 0;
  let color = '';
  let time = 0;
  let last = 0;
  let lastPaint = 0;
  let raf = 0;
  let visible = true;

  const measureContent = (): void => {
    const origin = canvas.getBoundingClientRect();
    slots.avoid = Array.from(root.children)
      .filter((child) => !child.contains(canvas))
      .map((child) => {
        const r = child.getBoundingClientRect();
        return { x0: r.left - origin.left - 16, y0: r.top - origin.top - 12, x1: r.right - origin.left + 16, y1: r.bottom - origin.top + 12 };
      });
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    slots.width = rect.width;
    slots.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(rect.width / CELL) + 1;
    rows = Math.ceil(rect.height / CELL) + 1;
    field = new Float32Array(cols * rows);
    color = getComputedStyle(canvas).color;
    measureContent();
  };

  const paint = (now: number): void => {
    sample(field, cols, rows, time, hill, ripples, now);
    const paths = { minor: new Path2D(), major: new Path2D(), slots };
    slots.best.clear();
    slots.drift = time * 6;
    traceContours(field, cols, rows, INTERVAL, paths);
    ctx.clearRect(0, 0, slots.width, slots.height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 0.75;
    ctx.stroke(paths.minor);
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.1;
    ctx.stroke(paths.major);
    drawLabels(ctx, slots);
    ctx.globalAlpha = 1;
  };

  const frame = (now: number): void => {
    raf = 0;
    if (!visible) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    const hillMoving = stepHill(hill, dt);
    while (ripples[0] && now - ripples[0].start > RIPPLE_MS) ripples.shift();
    const settling = hillMoving || ripples.length > 0;
    time += dt;
    // The drift alone is slow; anything following the hand gets every frame.
    if (settling || now - lastPaint >= IDLE_FRAME_MS) {
      paint(now);
      lastPaint = now;
    }
    raf = requestAnimationFrame(frame);
  };

  const start = (): void => {
    if (!raf && visible && !reduceMotion) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  // Follow theme changes: the canvas color comes from CSS, so check it now and then while on screen.
  const colorTimer = window.setInterval(() => {
    const next = getComputedStyle(canvas).color;
    if (next === color) return;
    color = next;
    if (!raf) paint(performance.now());
  }, 500);

  resize();
  paint(performance.now());
  canvas.style.opacity = '1';
  start();

  const resizeObserver = new ResizeObserver(() => {
    resize();
    paint(performance.now());
  });
  resizeObserver.observe(canvas);

  // Stop drawing while hidden (another view covers it, or the window is in the background).
  let onScreen = true;
  const updateVisible = (): void => {
    visible = onScreen && document.visibilityState === 'visible';
    if (visible) start();
  };
  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
    updateVisible();
  });
  intersection.observe(root);
  document.addEventListener('visibilitychange', updateVisible);

  const stopPointer = reduceMotion ? () => undefined : followPointer(root, canvas, hill, ripples, start);

  return () => {
    cancelAnimationFrame(raf);
    window.clearInterval(colorTimer);
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener('visibilitychange', updateVisible);
    stopPointer();
  };
}

/** Raises a hill under the mouse and sends a ripple on a click that isn't on a button. */
function followPointer(root: HTMLElement, canvas: HTMLCanvasElement, hill: Hill, ripples: Ripple[], wake: () => void): () => void {
  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const point = local(event);
    // Rise where the cursor came in rather than sliding over from where it left.
    if (!hill.on) Object.assign(hill, { x: point.x, y: point.y });
    Object.assign(hill, { targetX: point.x, targetY: point.y, on: true });
    wake();
  };
  const onLeave = (): void => {
    hill.on = false;
    wake();
  };
  const onDown = (event: PointerEvent): void => {
    if (event.target instanceof Element && event.target.closest('a, button, input, textarea')) return;
    ripples.push({ ...local(event), start: performance.now() });
    if (ripples.length > 4) ripples.shift();
    wake();
  };
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('pointerdown', onDown);
  return () => {
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    root.removeEventListener('pointerdown', onDown);
  };
}
