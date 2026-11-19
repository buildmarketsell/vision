import { Copy, Trash2 } from 'lucide-react';
import type { Block } from '../../../shared/pages';
import { BLOCK_KINDS, isTextBlock } from './blockTypes';
import { Popover, type Anchor } from './Popover';

/** The ⋮⋮ menu: turn a text block into another kind, duplicate it, or delete it. */
export function BlockMenu({ anchor, block, onTurnInto, onDuplicate, onDelete, onClose }: {
  anchor: Anchor;
  block: Block;
  onTurnInto: (type: Block['type']) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const textKinds = BLOCK_KINDS.filter((kind) => isTextBlock(kind.type));
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  return (
    <Popover anchor={anchor} width={240} label="Block options" onClose={onClose}>
      <div className="db-menu-list">
        <button className="row w-full" onClick={run(onDuplicate)}>
          <Copy size={14} strokeWidth={1.75} /> Duplicate
        </button>
        <button className="row w-full db-danger" onClick={run(onDelete)}>
          <Trash2 size={14} strokeWidth={1.75} /> Delete
        </button>
        {isTextBlock(block.type) && (
          <>
            <div className="db-menu-divider" />
            <div className="db-menu-hint">Turn into</div>
            {textKinds.map((kind) => (
              <button key={kind.type} className="row w-full" aria-pressed={kind.type === block.type} onClick={run(() => onTurnInto(kind.type))}>
                <kind.icon size={14} strokeWidth={1.75} /> {kind.label}
              </button>
            ))}
          </>
        )}
      </div>
    </Popover>
  );
}
