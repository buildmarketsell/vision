/*
 * The terrain under the topo background: drifting noise, a hill that follows the cursor,
 * and ripples from clicks. Adapted from KokonutUI's "Topo Background" (kokonutui.com), MIT licence.
 */
import { CELL } from './contours';
import { createNoise } from './noise';

/** Width of a hill in the terrain, in px. */
const TERRAIN_SCALE = 360;
const HILL_HEIGHT = 0.5;
const HILL_SPREAD = 120;
/** How quickly the hill catches up with the cursor, and rises or sinks (per second). */
const HILL_FOLLOW = 9;
const HILL_RISE = 5;
export const RIPPLE_MS = 1800;
const RIPPLE_SPEED = 0.24;
const RIPPLE_WIDTH = 42;
const RIPPLE_HEIGHT = 0.2;
const RIPPLE_WAVELENGTH = 96;

export interface Hill {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  amount: number;
  on: boolean;
}

export interface Ripple {
  x: number;
  y: number;
  start: number;
}

/** Eases the hill towards the cursor and up or down. True while it still moves. */
export function stepHill(hill: Hill, dt: number): boolean {
  const follow = 1 - Math.exp(-HILL_FOLLOW * dt);
  hill.x += (hill.targetX - hill.x) * follow;
  hill.y += (hill.targetY - hill.y) * follow;
  const goal = hill.on ? 1 : 0;
  hill.amount += (goal - hill.amount) * (1 - Math.exp(-HILL_RISE * dt));
  return Math.abs(hill.targetX - hill.x) > 0.5 || Math.abs(hill.targetY - hill.y) > 0.5 || Math.abs(goal - hill.amount) > 0.002;
}

/** A short train of crests and troughs, like a stone dropped in water. */
function rippleAt(ripple: Ripple, x: number, y: number, now: number): number {
  const age = now - ripple.start;
  const d = Math.hypot(x - ripple.x, y - ripple.y) - age * RIPPLE_SPEED;
  const fadeOut = 1 - age / RIPPLE_MS;
  return RIPPLE_HEIGHT * fadeOut * fadeOut * Math.exp(-(d * d) / (2 * RIPPLE_WIDTH * RIPPLE_WIDTH)) * Math.cos((d / RIPPLE_WAVELENGTH) * Math.PI * 2);
}

/** Fills `field` (cols × rows samples, CELL apart) with the terrain at `time` seconds. */
export function createSampler(seed: number) {
  const noise = createNoise(seed);
  return (field: Float32Array, cols: number, rows: number, time: number, hill: Hill, ripples: Ripple[], now: number): void => {
    const z = time * 0.05;
    const drift = time * 6;
    const spread = 2 * HILL_SPREAD * HILL_SPREAD;
    for (let j = 0; j < rows; j++) {
      const y = j * CELL;
      for (let i = 0; i < cols; i++) {
        const x = i * CELL;
        const nx = (x + drift) / TERRAIN_SCALE;
        const ny = y / TERRAIN_SCALE;
        let v = noise(nx, ny, z) * 0.78 + noise(nx * 2.3 + 17.1, ny * 2.3 + 4.7, z * 1.4) * 0.22;
        if (hill.amount > 0.001) {
          const dx = x - hill.x;
          const dy = y - hill.y;
          v += HILL_HEIGHT * hill.amount * Math.exp(-(dx * dx + dy * dy) / spread);
        }
        for (const ripple of ripples) v += rippleAt(ripple, x, y, now);
        field[j * cols + i] = v;
      }
    }
  };
}
