import { useEffect, useRef } from 'react';
import { Popover, type Anchor } from './Popover';
import type { BlockKind } from './blockTypes';

/** Notion's "/" menu. Focus stays in the block: it filters as you type, arrows move, Enter picks. */
export function SlashMenu({ anchor, kinds, selected, onPick, onHover, onClose }: {
  anchor: Anchor;
  kinds: BlockKind[];
  selected: number;
  onPick: (kind: BlockKind) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  return (
    <Popover anchor={anchor} width={320} label="Insert a block" onClose={onClose}>
      <div className="db-menu-hint">{kinds.length ? 'Basic blocks' : 'No results'}</div>
      <div ref={listRef} className="db-menu-list notion-slash" role="listbox" aria-label="Blocks">
        {kinds.map((kind, index) => (
          <button
            key={kind.type}
            role="option"
            aria-selected={index === selected}
            className="notion-slash-item"
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(kind)}
          >
            <span className="notion-slash-icon"><kind.icon size={20} strokeWidth={1.5} /></span>
            <span className="flex min-w-0 flex-col">
              <span>{kind.label}</span>
              <span className="notion-slash-hint truncate">{kind.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
