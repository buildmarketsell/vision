import { describe, expect, it } from 'vitest';
import { areaPath, axisTicks, chartPoints, smoothPath } from '../../src/features/content/renderer/chartPath';

/** Every y value the curve passes through, sampled along each cubic segment. */
function sampledYs(path: string): number[] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const ys: number[] = [];
  let y0 = numbers[1] ?? 0;
  for (let index = 2; index + 5 < numbers.length + 1; index += 6) {
    const [c1, c2, y1] = [numbers[index + 1] ?? 0, numbers[index + 3] ?? 0, numbers[index + 5] ?? 0];
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t;
      ys.push(u * u * u * y0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * y1);
    }
    y0 = y1;
  }
  return ys;
}

describe('chart geometry', () => {
  it('places the highest value at the top and the lowest at the bottom', () => {
    expect(chartPoints([10, 30, 20], 200, 100, 10, 20)).toEqual([[0, 80], [100, 10], [200, 45]]);
  });

  it('puts a flat series in the middle', () => {
    expect(chartPoints([5, 5], 100, 100, 0, 0)).toEqual([[0, 50], [100, 50]]);
  });

  it('draws one curve segment per gap and starts at the first point', () => {
    const path = smoothPath([[0, 50], [50, 10], [100, 30]]);
    expect(path.startsWith('M0.0,50.0')).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
    expect(path.endsWith('100.0,30.0')).toBe(true);
  });

  it('never bulges past the highest or lowest reading', () => {
    const points = chartPoints([100, 100, 400, 90, 95, 300, 300], 600, 180, 20, 60);
    const ys = sampledYs(smoothPath(points));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20 - 0.1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(120 + 0.1);
  });

  it('handles empty and single-point series', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[5, 5]])).toBe('M5.0,5.0');
    expect(areaPath([], 10)).toBe('');
  });

  it('closes the area down to the floor', () => {
    expect(areaPath([[0, 10], [100, 20]], 180).endsWith('L100.0,180.0 L0.0,180.0 Z')).toBe(true);
  });

  it('spreads date labels with the first and the last', () => {
    expect(axisTicks(3)).toEqual([0, 1, 2]);
    expect(axisTicks(30)).toEqual([0, 10, 19, 29]);
  });
});
