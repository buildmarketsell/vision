/**
 * Scrollbars that stay out of the way, like macOS's own: the thumb shows only while a list scrolls
 * (and a moment after) or while the pointer is over the bar. Sets `data-scrolling` and
 * `data-scrollbar-hover` on the scrolling element; `styles/scrollbars.css` draws the thumb.
 */
const HIDE_AFTER_MS = 900;

export interface ScrollerBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Width of the vertical bar (offsetWidth − clientWidth) and height of the horizontal one. */
  barWidth: number;
  barHeight: number;
}

/** True when the point is on the element's vertical or horizontal scrollbar. */
export function isOnScrollbar(box: ScrollerBox, x: number, y: number): boolean {
  const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  if (!inside) return false;
  return (box.barWidth > 0 && x >= box.right - box.barWidth) || (box.barHeight > 0 && y >= box.bottom - box.barHeight);
}

function boxOf(element: Element): ScrollerBox {
  const rect = element.getBoundingClientRect();
  const html = element as HTMLElement;
  const border = (side: 'Left' | 'Right' | 'Top' | 'Bottom') => parseFloat(getComputedStyle(element)[`border${side}Width`]) || 0;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right - border('Right'),
    bottom: rect.bottom - border('Bottom'),
    barWidth: html.offsetWidth - html.clientWidth - border('Left') - border('Right'),
    barHeight: html.offsetHeight - html.clientHeight - border('Top') - border('Bottom'),
  };
}

export function installScrollbars(): void {
  const timers = new WeakMap<Element, number>();
  let hovered: Element | null = null;

  document.addEventListener(
    'scroll',
    (event) => {
      const target = event.target === document ? document.scrollingElement : (event.target as Element);
      if (!target) return;
      target.setAttribute('data-scrolling', '');
      window.clearTimeout(timers.get(target));
      timers.set(target, window.setTimeout(() => target.removeAttribute('data-scrolling'), HIDE_AFTER_MS));
    },
    true,
  );

  // Over a scrollbar, the pointer's target is the scrolling element itself.
  document.addEventListener(
    'pointermove',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const next = target && isOnScrollbar(boxOf(target), event.clientX, event.clientY) ? target : null;
      if (next === hovered) return;
      hovered?.removeAttribute('data-scrollbar-hover');
      next?.setAttribute('data-scrollbar-hover', '');
      hovered = next;
    },
    { capture: true, passive: true },
  );
}
