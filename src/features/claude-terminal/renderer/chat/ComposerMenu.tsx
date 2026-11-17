import { useEffect, useRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  detail?: string;
  selected?: boolean;
}

interface ComposerMenuProps {
  label: string;
  items: MenuItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (item: MenuItem) => void;
  empty?: ReactNode;
  /** Shown under the list (the model picker's effort control). */
  footer?: ReactNode;
}

/** A popover list that grows up out of the message box (model picker, slash commands). */
export function ComposerMenu({ label, items, activeIndex, onHover, onPick, empty, footer }: ComposerMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div ref={listRef} role="listbox" aria-label={label} className="composer-menu menu" onMouseDown={(event) => event.preventDefault()}>
      {items.length === 0 && <div className="caption px-3 py-2">{empty}</div>}
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          aria-selected={item.selected ?? index === activeIndex}
          data-active={index === activeIndex}
          className="composer-menu-item"
          onMouseEnter={() => onHover(index)}
          onClick={() => onPick(item)}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{item.label}</div>
            {item.detail && <div className="caption truncate">{item.detail}</div>}
          </div>
          {item.selected && <Check size={14} strokeWidth={2} color="var(--color-accent)" />}
        </div>
      ))}
      {footer}
    </div>
  );
}
