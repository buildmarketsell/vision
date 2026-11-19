import { useEffect, type RefObject } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { dotGrid } from '../dotGrid';

/** Keeps the dot grid behind the canvas in step with Excalidraw's scroll and zoom (CSS variables, no re-render). */
export function useDotGrid(api: ExcalidrawImperativeAPI | null, stage: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!api) return;
    const place = (scrollX: number, scrollY: number, zoom: number) => {
      const element = stage.current;
      if (!element) return;
      const { gap, x, y } = dotGrid(scrollX, scrollY, zoom);
      element.style.setProperty('--dot-gap', `${gap}px`);
      element.style.setProperty('--dot-x', `${x}px`);
      element.style.setProperty('--dot-y', `${y}px`);
    };
    const { scrollX, scrollY, zoom } = api.getAppState();
    place(scrollX, scrollY, zoom.value);
    return api.onScrollChange((x, y, z) => place(x, y, z.value));
  }, [api, stage]);
}
