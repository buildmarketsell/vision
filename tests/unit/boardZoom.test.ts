import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, wheelZoom, zoomAround } from '../../src/features/board/boardZoom';

describe('board zoom', () => {
  it('keeps the point under the pointer still', () => {
    const before = { scrollX: 40, scrollY: -20, zoom: 1 };
    const after = zoomAround(before, 2, 300, 200);
    // Board point under the pointer: view / zoom - scroll.
    expect(300 / after.zoom - after.scrollX).toBeCloseTo(300 / before.zoom - before.scrollX);
    expect(200 / after.zoom - after.scrollY).toBeCloseTo(200 / before.zoom - before.scrollY);
  });

  it('zooms by the same percentage at any zoom level', () => {
    const near = wheelZoom({ scrollX: 0, scrollY: 0, zoom: 4 }, 10, 0, 0);
    const far = wheelZoom({ scrollX: 0, scrollY: 0, zoom: 0.2 }, 10, 0, 0);
    expect(near.zoom / 4).toBeCloseTo(far.zoom / 0.2);
    expect(far.zoom).toBeLessThan(0.2);
  });

  it('caps a big mouse-wheel notch and stays within the limits', () => {
    const notch = wheelZoom({ scrollX: 0, scrollY: 0, zoom: 1 }, -100, 0, 0);
    expect(notch.zoom).toBeLessThan(1.7);
    expect(wheelZoom({ scrollX: 0, scrollY: 0, zoom: MIN_ZOOM }, 50, 0, 0).zoom).toBe(MIN_ZOOM);
    expect(wheelZoom({ scrollX: 0, scrollY: 0, zoom: MAX_ZOOM }, -50, 0, 0).zoom).toBe(MAX_ZOOM);
  });
});
