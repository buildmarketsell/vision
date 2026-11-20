import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Where a row sits inside its (scrolling) list, so the highlight can be moved there with transform only. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** `instant`: the highlight was hidden, so it appears in place instead of gliding in from the old spot. */
interface Spot {
  box: Box | null;
  instant: boolean;
}

function boxIn(list: HTMLElement, row: Element): Box {
  const outer = list.getBoundingClientRect();
  const inner = row.getBoundingClientRect();
  return { x: inner.left - outer.left + list.scrollLeft, y: inner.top - outer.top + list.scrollTop, width: inner.width, height: inner.height };
}

function Pill({ spot, kind }: { spot: Spot; kind: 'hover' | 'selected' }) {
  const { box, instant } = spot;
  return (
    <span
      aria-hidden
      className="glide-pill"
      data-kind={kind}
      data-shown={box !== null}
      data-instant={instant}
      style={box ? { width: box.width, height: box.height, transform: `translate(${box.x}px, ${box.y}px)` } : undefined}
    />
  );
}

interface Props {
  /** The list; it needs `position: relative`, and the pill must come before its rows. */
  list: RefObject<HTMLElement | null>;
  /** Selector for the rows the pill moves between. */
  rows: string;
}

/**
 * A soft highlight that glides from row to row under the pointer or keyboard focus (after beui's animated
 * sidebar and file tree), instead of each row lighting up on its own.
 */
export function HoverGlide({ list, rows }: Props) {
  const [spot, setSpot] = useState<Spot>({ box: null, instant: true });
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const follow = (event: Event) => {
      const row = (event.target as Element).closest(rows);
      if (row && element.contains(row)) setSpot((previous) => ({ box: boxIn(element, row), instant: previous.box === null }));
    };
    const hide = () => setSpot((previous) => ({ ...previous, box: null }));
    const hideUnlessFocused = () => !element.contains(document.activeElement) && hide();
    element.addEventListener('pointerover', follow);
    element.addEventListener('focusin', follow);
    element.addEventListener('pointerleave', hideUnlessFocused);
    element.addEventListener('focusout', hide);
    element.addEventListener('scroll', hide);
    return () => {
      element.removeEventListener('scroll', hide);
      element.removeEventListener('pointerover', follow);
      element.removeEventListener('focusin', follow);
      element.removeEventListener('pointerleave', hideUnlessFocused);
      element.removeEventListener('focusout', hide);
    };
  }, [list, rows]);
  return <Pill spot={spot} kind="hover" />;
}

/** The selected row's highlight; glides to the new row whenever `selected` changes. */
export function SelectedGlide({ list, rows, selected }: Props & { selected: string }) {
  const [spot, setSpot] = useState<Spot>({ box: null, instant: true });
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const place = (instant: boolean) => {
      const row = element.querySelector(rows);
      setSpot((previous) => ({ box: row ? boxIn(element, row) : null, instant: instant || previous.box === null }));
    };
    place(false);
    // The window resizing moves rows pinned to the bottom; follow without gliding.
    const observer = new ResizeObserver(() => place(true));
    observer.observe(element);
    return () => observer.disconnect();
  }, [list, rows, selected]);
  return <Pill spot={spot} kind="selected" />;
}
