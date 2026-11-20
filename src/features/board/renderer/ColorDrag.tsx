import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

/** Where the pointer is inside an element, 0–1 on each axis. */
type Point = { x: number; y: number };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Pointer speed (fraction of the width per ms) to loupe tilt in degrees, capped at ±16 like beui. */
const TILT_PER_SPEED = 40;
const MAX_TILT = 16;

/**
 * Pointer dragging with capture: `onMove` on every move (a live preview), `onEnd` once on release (one
 * undo step). Also reports the tilt for the loupe, from how fast the pointer moves sideways.
 */
function useDrag(onMove: (point: Point) => void, onEnd: () => void) {
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const last = useRef({ x: 0, time: 0 });
  const pointAt = (event: PointerEvent<HTMLElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) };
  };
  return {
    dragging,
    tilt,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        const point = pointAt(event);
        last.current = { x: point.x, time: event.timeStamp };
        setDragging(true);
        onMove(point);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (!dragging) return;
        const point = pointAt(event);
        const elapsed = Math.max(1, event.timeStamp - last.current.time);
        const speed = (point.x - last.current.x) / elapsed;
        last.current = { x: point.x, time: event.timeStamp };
        setTilt(Math.max(-MAX_TILT, Math.min(MAX_TILT, speed * TILT_PER_SPEED * 100)));
        onMove(point);
      },
      onPointerUp: () => {
        if (!dragging) return;
        setDragging(false);
        setTilt(0);
        onEnd();
      },
      onLostPointerCapture: () => setDragging(false),
    },
  };
}

/** Arrow keys step 1%, Shift or PageUp/Down 10%, Home/End jump to the ends. Returns the new 0–1 value. */
function stepped(key: string, shift: boolean, value: number, axis: 'x' | 'y'): number | undefined {
  const step = shift || key.startsWith('Page') ? 0.1 : 0.01;
  const up = axis === 'x' ? ['ArrowRight', 'PageUp'] : ['ArrowUp', 'PageUp'];
  const down = axis === 'x' ? ['ArrowLeft', 'PageDown'] : ['ArrowDown', 'PageDown'];
  if (up.includes(key)) return clamp01(value + step);
  if (down.includes(key)) return clamp01(value - step);
  if (key === 'Home') return 0;
  if (key === 'End') return 1;
  return undefined;
}

/** The thumb, and while dragging the loupe above it: a tilted drop showing the color under the thumb. */
function Thumb({ color, dragging, tilt }: { color: string; dragging: boolean; tilt: number }) {
  return (
    <span className="cp-thumb" data-dragging={dragging} style={{ '--cp-color': color } as CSSProperties}>
      <span className="cp-loupe" style={{ '--cp-tilt': `${tilt}deg` } as CSSProperties} aria-hidden />
    </span>
  );
}

interface AreaProps {
  hue: number;
  saturation: number;
  brightness: number;
  color: string;
  onChange: (saturation: number, brightness: number) => void;
  onCommit: () => void;
}

/** Saturation left to right, brightness bottom to top, over the current hue. */
export function ColorArea({ hue, saturation, brightness, color, onChange, onCommit }: AreaProps) {
  const drag = useDrag(({ x, y }) => onChange(x, 1 - y), onCommit);
  const onKeyDown = (event: KeyboardEvent) => {
    const isVertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const next = stepped(event.key, event.shiftKey, isVertical ? brightness : saturation, isVertical ? 'y' : 'x');
    if (next === undefined) return;
    event.preventDefault();
    onChange(isVertical ? saturation : next, isVertical ? next : brightness);
  };
  return (
    <div
      className="cp-area"
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(brightness * 100)}%`}
      style={{ '--cp-hue': `hsl(${hue} 100% 50%)` } as CSSProperties}
      onKeyDown={onKeyDown}
      onKeyUp={onCommit}
      {...drag.handlers}
    >
      <span className="cp-track" style={{ '--cp-x': saturation, '--cp-y': 1 - brightness } as CSSProperties}>
        <Thumb color={color} dragging={drag.dragging} tilt={drag.tilt} />
      </span>
    </div>
  );
}

/** The hue rainbow, 0–360. */
export function HueSlider({ hue, onChange, onCommit }: { hue: number; onChange: (hue: number) => void; onCommit: () => void }) {
  const drag = useDrag(({ x }) => onChange(x * 360), onCommit);
  const onKeyDown = (event: KeyboardEvent) => {
    const next = stepped(event.key, event.shiftKey, hue / 360, 'x');
    if (next === undefined) return;
    event.preventDefault();
    onChange(next * 360);
  };
  return (
    <div
      className="cp-hue"
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      onKeyDown={onKeyDown}
      onKeyUp={onCommit}
      {...drag.handlers}
    >
      <span className="cp-track" style={{ '--cp-x': hue / 360, '--cp-y': 0.5 } as CSSProperties}>
        <Thumb color={`hsl(${hue} 100% 50%)`} dragging={drag.dragging} tilt={drag.tilt} />
      </span>
    </div>
  );
}
