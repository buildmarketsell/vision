import { useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { Block as BlockData, Page } from '../../../shared/pages';
import { insertAfter, listNumbers, moveBlock, newBlock, removeBlock, shortcutFor, updateBlock, visibleBlocks } from '../../../shared/pageOps';
import { Block, BLOCK_DRAG } from './Block';
import { BlockMenu } from './BlockMenu';
import { matchKinds, isTextBlock, type BlockKind } from './blockTypes';
import { anchorOf, type Anchor } from './Popover';
import { SlashMenu } from './SlashMenu';
import { createDb, newId } from './dbStore';
import { editBlocks, FocusKeeper, handleBlockKey, lastInside, turnInto } from './editorActions';
import { addPage } from './pageStore';

interface SlashState {
  blockId: string;
  /** Where the "/" is in the block's text. */
  start: number;
  selected: number;
  anchor: Anchor;
}

const slashQuery = (block: BlockData | undefined, slash: SlashState) => (block?.text.slice(slash.start + 1).split(/\s/)[0] ?? '');

/** A page's blocks, edited like Notion: type, "/" for blocks, markdown shortcuts, Tab to nest, drag ⋮⋮ to move. */
export function BlockEditor({ page, pages, onOpen }: { page: Page; pages: Page[]; onOpen: (kind: 'page' | 'database', id: string) => void }) {
  const keeper = useRef(new FocusKeeper()).current;
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [menu, setMenu] = useState<{ anchor: Anchor; blockId: string } | null>(null);
  useLayoutEffect(() => keeper.applyWaiting());

  const visible = visibleBlocks(page.blocks);
  const numbers = listNumbers(page.blocks);
  const edit = (change: (blocks: BlockData[]) => BlockData[]) => editBlocks(page.id, change);
  const slashBlock = slash ? page.blocks.find((block) => block.id === slash.blockId) : undefined;
  const kinds = slash ? matchKinds(slashQuery(slashBlock, slash)) : [];

  const pick = (kind: BlockKind) => {
    if (!slash || !slashBlock) return;
    const query = slashQuery(slashBlock, slash);
    const rest = slashBlock.text.slice(0, slash.start) + slashBlock.text.slice(slash.start + 1 + query.length);
    setSlash(null);
    const ref = kind.type === 'page' ? addPage(page.id).id : kind.type === 'database' ? createDb().id : undefined;
    if (rest.trim() === '') {
      edit((blocks) => updateBlock(blocks, slashBlock.id, { text: '', ...(ref ? { ref } : {}) }));
      if (ref) edit((blocks) => insertAfter(updateBlock(blocks, slashBlock.id, { type: kind.type }), slashBlock.id, newBlock('text', newId, slashBlock.indent)));
      else turnInto(page, { ...slashBlock, text: '' }, kind.type, keeper);
    } else {
      const created = { ...newBlock(kind.type, newId, slashBlock.indent), ...(ref ? { ref } : {}) };
      edit((blocks) => insertAfter(updateBlock(blocks, slashBlock.id, { text: rest }), slashBlock.id, created));
      if (isTextBlock(kind.type)) keeper.focus(created.id, 0);
    }
    if (kind.type === 'page' && ref) onOpen('page', ref);
  };

  const onChange = (block: BlockData) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    const caret = event.target.selectionStart;
    const shortcut = block.type === 'text' ? shortcutFor(text) : null;
    if (shortcut && caret <= text.length - shortcut.text.length) {
      turnInto(page, block, shortcut.type, keeper);
      if (shortcut.type === 'divider') return;
      edit((blocks) => updateBlock(blocks, block.id, { text: shortcut.text }));
      keeper.focus(block.id, 0);
      return;
    }
    const typedSlash = text.length === block.text.length + 1 && text[caret - 1] === '/' && (caret === 1 || /\s/.test(text[caret - 2] ?? ''));
    if (typedSlash) setSlash({ blockId: block.id, start: caret - 1, selected: 0, anchor: anchorOf(event.target) });
    else if (slash?.blockId === block.id && text[slash.start] !== '/') setSlash(null);
    edit((blocks) => updateBlock(blocks, block.id, { text }));
  };

  const onDrop = (target: BlockData) => (event: DragEvent<HTMLDivElement>) => {
    const id = event.dataTransfer.getData(BLOCK_DRAG);
    if (!id) return;
    const before = event.currentTarget.dataset.drop === 'before';
    edit((blocks) => {
      const afterTarget = blocks[blocks.findIndex((block) => block.id === lastInside(blocks, target)) + 1];
      return moveBlock(blocks, id, before ? target.id : (afterTarget?.id ?? null));
    });
  };

  const menuBlock = menu && page.blocks.find((block) => block.id === menu.blockId);
  return (
    <div className="notion-blocks">
      {visible.map((block) => (
        <Block
          key={block.id}
          block={block}
          number={numbers.get(block.id)}
          linked={block.type === 'page' ? pages.find((candidate) => candidate.id === block.ref) : undefined}
          inputRef={(element) => keeper.register(block.id, element)}
          onChange={onChange(block)}
          onKeyDown={(event) => {
            if (slash?.blockId === block.id && kinds.length) {
              const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
              if (step) setSlash({ ...slash, selected: (slash.selected + step + kinds.length) % kinds.length });
              if (event.key === 'Enter') pick(kinds[slash.selected] ?? (kinds[0] as BlockKind));
              if (event.key === 'Escape') setSlash(null);
              if (step || event.key === 'Enter' || event.key === 'Escape') return event.preventDefault();
            }
            if (handleBlockKey(event, page, visible, block, keeper)) event.preventDefault();
          }}
          onPatch={(patch) => edit((blocks) => updateBlock(blocks, block.id, patch))}
          onOpen={onOpen}
          onAdd={() => {
            const created = newBlock('text', newId, block.indent);
            edit((blocks) => insertAfter(blocks, lastInside(blocks, block), created));
            keeper.focus(created.id, 0);
          }}
          onMenu={(event) => setMenu({ anchor: anchorOf(event.currentTarget), blockId: block.id })}
          onDropOn={onDrop(block)}
        />
      ))}
      <button
        className="notion-blocks-end"
        aria-label="Add a block at the end"
        onClick={() => {
          const last = page.blocks.at(-1);
          if (last && isTextBlock(last.type) && last.text === '') return keeper.focusNow(last.id, 0);
          const created = newBlock('text', newId);
          edit((blocks) => [...blocks, created]);
          keeper.focus(created.id, 0);
        }}
      />
      {slash && <SlashMenu anchor={slash.anchor} kinds={kinds} selected={slash.selected} onPick={pick} onHover={(selected) => setSlash({ ...slash, selected })} onClose={() => setSlash(null)} />}
      {menu && menuBlock && (
        <BlockMenu
          anchor={menu.anchor}
          block={menuBlock}
          onTurnInto={(type) => turnInto(page, menuBlock, type, keeper)}
          onDuplicate={() => edit((blocks) => insertAfter(blocks, menuBlock.id, { ...menuBlock, id: newId() }))}
          onDelete={() => edit((blocks) => removeBlock(blocks, menuBlock.id))}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
