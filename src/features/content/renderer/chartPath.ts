/** Chart geometry for the Content page, kept pure so it can be unit tested. */

export type Point = readonly [x: number, y: number];

const at = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;

/**
 * Places values left to right across `width`, highest at `top`, lowest at `height - bottom`.
 * A flat series sits in the middle instead of on the floor.
 */
export function chartPoints(values: number[], width: number, height: number, top: number, bottom: number): Point[] {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const room = height - top - bottom;
  return values.map((value, index) => [
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    span === 0 ? top + room / 2 : top + (1 - (value - min) / span) * room,
  ]);
}

/**
 * A smooth line through every point (monotone cubic, Fritsch–Carlson).
 * Unlike a plain spline it never bulges past a peak or dip, so the curve never shows a number that was not read.
 */
export function smoothPath(points: Point[]): string {
  const first = points[0];
  if (!first) return '';
  const slopes = points.slice(1).map(([x, y], index) => {
    const [px, py] = points[index] ?? first;
    return x === px ? 0 : (y - py) / (x - px);
  });
  const tangents = points.map((_, index) => {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }
    const a = (tangents[index] ?? 0) / slope;
    const b = (tangents[index + 1] ?? 0) / slope;
    const size = a * a + b * b;
    if (size > 9) {
      const scale = 3 / Math.sqrt(size);
      tangents[index] = scale * a * slope;
      tangents[index + 1] = scale * b * slope;
    }
  });
  let path = `M${at(first)}`;
  for (let index = 1; index < points.length; index++) {
    const [x0, y0] = points[index - 1] ?? first;
    const [x1, y1] = points[index] ?? first;
    const third = (x1 - x0) / 3;
    path += ` C${at([x0 + third, y0 + (tangents[index - 1] ?? 0) * third])} ${at([x1 - third, y1 - (tangents[index] ?? 0) * third])} ${at([x1, y1])}`;
  }
  return path;
}

/** The smooth line closed down to `floor`, for the glowing fill under it. */
export function areaPath(points: Point[], floor: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${smoothPath(points)} L${at([last[0], floor])} L${at([first[0], floor])} Z`;
}

/** Up to `wanted` evenly spread indexes for the date labels, always the first and the last. */
export function axisTicks(count: number, wanted = 4): number[] {
  if (count <= wanted) return Array.from({ length: count }, (_, index) => index);
  return Array.from({ length: wanted }, (_, index) => Math.round((index * (count - 1)) / (wanted - 1)));
}
