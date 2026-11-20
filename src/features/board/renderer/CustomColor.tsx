import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_COLORS, hexOf } from '../boardStyle';
import { ColorPicker } from './ColorPicker';
import './color-picker.css';

const PANEL_WIDTH = 264;
const GAP = 8;

/** Opens the picker left of the style panel, level with the button, kept inside the window. */
function placeBeside(button: HTMLElement): { left: number; top: number } {
  const panel = button.closest('.board-style-panel') ?? button;
  const panelRect = panel.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const left = Math.max(GAP, panelRect.left - GAP - PANEL_WIDTH);
  const top = Math.max(GAP, Math.min(buttonRect.top - 12, window.innerHeight - 340));
  return { left, top };
}

/**
 * Any color, in VISION's own picker (after beui's motion color picker). The board follows live while
 * dragging; letting go, Enter or the eyedropper makes one undo step.
 */
export function CustomColor({ color, onPick }: { color: string; onPick: (color: string, final: boolean) => void }) {
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const isCustom = !BOARD_COLORS.some((entry) => entry.id === color);
  const hex = hexOf(color);
  const open = place !== null;

  useEffect(() => {
    if (!open) return;
    const close = (returnFocus: boolean) => {
      setPlace(null);
      if (returnFocus) button.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close(panel.current?.contains(document.activeElement) ?? false);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    panel.current?.querySelector<HTMLElement>('[role="slider"]')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        className="board-custom-color"
        aria-pressed={isCustom}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setPlace(open || !button.current ? null : placeBeside(button.current))}
      >
        <span className="board-custom-chip" style={{ background: hex }} aria-hidden />
        <span>Custom color</span>
      </button>
      {place &&
        createPortal(
          <div ref={panel} className="cp-popover" role="dialog" aria-label="Color picker" style={{ left: place.left, top: place.top, width: PANEL_WIDTH }}>
            <ColorPicker initial={hex} onPick={onPick} />
          </div>,
          document.body,
        )}
    </>
  );
}
