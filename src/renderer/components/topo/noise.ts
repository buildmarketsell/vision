/*
 * Topo background, adapted from KokonutUI's "Topo Background" by @dorianbaffier
 * (https://kokonutui.com, github.com/kokonut-labs/kokonutui), MIT licence.
 */

/** Seeded 3D gradient noise (Ken Perlin's improved noise), about -1 to 1. */
export function createNoise(seed: number): (x: number, y: number, z: number) => number {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let state = seed >>> 0 || 1;
  const random = (): number => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const held = p[i] ?? 0;
    p[i] = p[j] ?? 0;
    p[j] = held;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255] ?? 0;
  const at = (i: number): number => perm[i] ?? 0;

  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const grad = (hash: number, x: number, y: number, z: number): number => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    let v = z;
    if (h < 4) v = y;
    else if (h === 12 || h === 14) v = x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    const A = at(X) + Y;
    const AA = at(A) + Z;
    const AB = at(A + 1) + Z;
    const B = at(X + 1) + Y;
    const BA = at(B) + Z;
    const BB = at(B + 1) + Z;
    const near = lerp(
      lerp(grad(at(AA), fx, fy, fz), grad(at(BA), fx - 1, fy, fz), u),
      lerp(grad(at(AB), fx, fy - 1, fz), grad(at(BB), fx - 1, fy - 1, fz), u),
      v,
    );
    const far = lerp(
      lerp(grad(at(AA + 1), fx, fy, fz - 1), grad(at(BA + 1), fx - 1, fy, fz - 1), u),
      lerp(grad(at(AB + 1), fx, fy - 1, fz - 1), grad(at(BB + 1), fx - 1, fy - 1, fz - 1), u),
      v,
    );
    return lerp(near, far, w);
  };
}
