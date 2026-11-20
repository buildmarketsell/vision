import { useEffect, type RefObject } from 'react';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { wheelZoom } from '../boardZoom';

type Zoom = AppState['zoom']['value'];

/** After the last zoom step, shapes and images are redrawn sharp at the new size (Excalidraw waits 300 ms). */
const SETTLE_MS = 200;

/**
 * Pinch and ⌘-scroll zoom by a steady percentage, as in FigJam, instead of Excalidraw's own step.
 * Listens before Excalidraw (capture phase) and stops the event so Excalidraw doesn't zoom too.
 * While zooming, Excalidraw reuses its cached drawings (`shouldCacheIgnoreZoom`), which keeps big boards smooth.
 */
export function useSmoothZoom(api: ExcalidrawImperativeAPI | null, stage: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = stage.current;
    if (!api || !element) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !(event.target instanceof HTMLCanvasElement)) return;
      event.preventDefault();
      event.stopPropagation();
      const { scrollX, scrollY, zoom, offsetLeft, offsetTop } = api.getAppState();
      const view = wheelZoom({ scrollX, scrollY, zoom: zoom.value }, event.deltaY, event.clientX - offsetLeft, event.clientY - offsetTop);
      api.updateScene({ appState: { zoom: { value: view.zoom as Zoom }, scrollX: view.scrollX, scrollY: view.scrollY, shouldCacheIgnoreZoom: true } });
      clearTimeout(settle);
      settle = setTimeout(() => api.updateScene({ appState: { shouldCacheIgnoreZoom: false } }), SETTLE_MS);
    };
    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      clearTimeout(settle);
      element.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [api, stage]);
}
