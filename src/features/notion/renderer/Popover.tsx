import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CheckSquare, ChevronDownCircle, Hash, Link2, List, Text, Type } from 'lucide-react';
import type { PropertyType } from '../../../shared/databases';

export interface Anchor {
  left: number;
  top: number;
  /** Width of what opened it, so a cell editor can cover its cell. */
  width: number;
}

export const anchorOf = (element: Element): Anchor => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.bottom + 4, width: rect.width };
};

/**
 * A Notion menu under what opened it. On document.body because dock panes clip fixed-position children.
 * Closes on a click outside or Escape.
 */
export function Popover({ anchor, width = 260, onClose, children, label }: { anchor: Anchor; width?: number; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && onClose();
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top = Math.min(anchor.top, window.innerHeight - 120);
  return createPortal(
    <div ref={ref} role="dialog" aria-label={label} className="db-popover menu" style={{ left, top, width, maxHeight: window.innerHeight - top - 12 }}>
      {children}
    </div>,
    document.body,
  );
}

const TYPE_ICONS: Record<PropertyType, typeof Text> = {
  title: Type,
  text: Text,
  number: Hash,
  select: ChevronDownCircle,
  multi_select: List,
  date: Calendar,
  checkbox: CheckSquare,
  url: Link2,
};

export function TypeIcon({ type }: { type: PropertyType }) {
  const Icon = TYPE_ICONS[type];
  return <Icon size={14} strokeWidth={1.75} className="db-type-icon" aria-hidden />;
}
