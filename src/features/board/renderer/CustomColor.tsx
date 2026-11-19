import { useEffect, useRef } from 'react';
import { useLatest } from '../../../renderer/core/useLatest';
import { BOARD_COLORS, hexOf } from '../boardStyle';

/**
 * Any color, through the Mac's own color panel (a native color input). The board follows live while
 * the panel is open; the input's `change` (fired when a color is settled) makes it one undo step.
 */
export function CustomColor({ color, onPick }: { color: string; onPick: (color: string, final: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const isCustom = !BOARD_COLORS.some((entry) => entry.id === color);
  const latestPick = useLatest(onPick);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    // React's onChange is the live `input` event; the settled color only comes as the native `change`.
    const settle = () => latestPick.current(element.value, true);
    element.addEventListener('change', settle);
    return () => element.removeEventListener('change', settle);
  }, [latestPick]);

  return (
    <label className="board-custom-color" aria-pressed={isCustom}>
      <input ref={input} type="color" aria-label="Custom color" value={hexOf(color)} onChange={(event) => onPick(event.target.value, false)} />
      <span>Custom color</span>
    </label>
  );
}
