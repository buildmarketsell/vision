import { useEffect, useRef, type ReactNode } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** A small right-click menu. Closes on any click outside, Escape, or after a choice. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      ref={ref}
      role="menu"
      className="menu fixed z-50 min-w-44 p-1"
      style={{
        left,
        top,
        transformOrigin: `${x - left}px ${y - top}px`,
        background: 'var(--color-card)',
        borderRadius: 'var(--radius-control)',
        boxShadow: 'var(--shadow-popover)',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          className="row w-full text-left"
          style={item.danger ? { color: 'var(--color-danger)' } : undefined}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
