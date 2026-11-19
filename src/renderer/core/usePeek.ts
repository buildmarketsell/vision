import { useEffect, useRef, useState } from 'react';

/** Long enough to cross the gap between the edge and the panel without it closing, short enough to feel instant. */
const CLOSE_DELAY_MS = 250;

/**
 * Notion's hidden sidebar: hovering the window edge (or the sidebar button) slides the panel out
 * over the page; leaving it slides it back. `show` and `hideSoon` go on everything that keeps it open.
 */
export function usePeek(enabled: boolean): { peeking: boolean; show: () => void; hideSoon: () => void; hide: () => void } {
  const [peeking, setPeeking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  return {
    peeking: enabled && peeking,
    show: () => {
      cancel();
      if (enabled) setPeeking(true);
    },
    hideSoon: () => {
      cancel();
      timer.current = setTimeout(() => setPeeking(false), CLOSE_DELAY_MS);
    },
    hide: () => {
      cancel();
      setPeeking(false);
    },
  };
}
