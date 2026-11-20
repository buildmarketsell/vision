/** Zoom limits for the board, shared by pinch, ⌘-scroll and the zoom buttons. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
/** How strongly one unit of wheel movement zooms. A trackpad pinch sends many small steps, a mouse wheel few big ones. */
const ZOOM_SPEED = 0.01;
/** A mouse wheel notch is ~100; capped so one notch zooms about 40%, not 270%. */
const MAX_WHEEL_STEP = 50;

export interface View {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The view zoomed to `nextZoom`, keeping the board point under (viewX, viewY) where it is on screen. */
export function zoomAround(view: View, nextZoom: number, viewX: number, viewY: number): View {
  const zoom = clampZoom(nextZoom);
  return {
    zoom,
    scrollX: view.scrollX + viewX / zoom - viewX / view.zoom,
    scrollY: view.scrollY + viewY / zoom - viewY / view.zoom,
  };
}

/**
 * FigJam-style wheel zoom: each step scales by a percentage, so a pinch feels the same at 10% and at 400%.
 * (Excalidraw adds a fixed amount instead, which jumps when zoomed out and crawls when zoomed in.)
 */
export function wheelZoom(view: View, deltaY: number, viewX: number, viewY: number): View {
  const step = Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, deltaY));
  return zoomAround(view, view.zoom * Math.exp(-step * ZOOM_SPEED), viewX, viewY);
}
