import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Check, GripVertical, Lightbulb, Plus } from 'lucide-react';
import type { Block as BlockData, Page } from '../../../shared/pages';
import { pageTitle } from '../../../shared/pageOps';
import { DatabasePage } from './DatabasePanel';
import { PageIcon } from './PageTree';
import { isTextBlock, kindOf } from './blockTypes';

export const BLOCK_DRAG = 'application/x-vision-block';
const BULLETS = ['•', '◦', '▪'];

export interface BlockProps {
  block: BlockData;
  number?: number;
  /** The page a page block points to. */
  linked?: Page;
  inputRef: (element: HTMLTextAreaElement | null) => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPatch: (patch: Partial<BlockData>) => void;
  onOpen: (kind: 'page' | 'database', id: string) => void;
  onAdd: () => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
  onDropOn: (event: DragEvent<HTMLDivElement>) => void;
}

function Marker({ block, number, onPatch }: Pick<BlockProps, 'block' | 'number' | 'onPatch'>): ReactNode {
  switch (block.type) {
    case 'bullet':
      return <span className="nb-marker nb-bullet" aria-hidden>{BULLETS[block.indent % BULLETS.length]}</span>;
    case 'numbered':
      return <span className="nb-marker nb-number" aria-hidden>{number ?? 1}.</span>;
    case 'todo':
      return (
        <span className="nb-marker">
          <button role="checkbox" aria-checked={block.checked === true} aria-label="Done" className="db-checkbox" onClick={() => onPatch({ checked: !block.checked })}>
            {block.checked && <Check size={12} strokeWidth={3} />}
          </button>
        </span>
      );
    case 'toggle':
      return (
        <span className="nb-marker">
          <button className="nb-toggle" aria-expanded={block.open === true} aria-label={block.open ? 'Close toggle' : 'Open toggle'} onClick={() => onPatch({ open: !block.open })}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M3 1.5 7.5 5 3 8.5Z" fill="currentColor" /></svg>
          </button>
        </span>
      );
    case 'callout':
      return <span className="nb-marker" aria-hidden><Lightbulb size={18} strokeWidth={1.5} /></span>;
    default:
      return null;
  }
}

function Body(props: BlockProps): ReactNode {
  const { block, linked, onOpen, inputRef, onChange, onKeyDown } = props;
  if (block.type === 'divider') return <div className="nb-divider" role="separator" />;
  if (block.type === 'page') {
    return (
      <button className="nb-page-link" onClick={() => block.ref && onOpen('page', block.ref)} disabled={!linked}>
        {linked ? <PageIcon page={linked} size={18} /> : null}
        <span className="nb-page-title">{linked ? pageTitle(linked) : 'Deleted page'}</span>
      </button>
    );
  }
  if (block.type === 'database') {
    return block.ref ? <DatabasePage id={block.ref} embedded onOpenFull={() => block.ref && onOpen('database', block.ref)} /> : null;
  }
  return (
    <div className="nb-text-row" data-type={block.type}>
      <Marker block={block} number={props.number} onPatch={props.onPatch} />
      <textarea
        ref={inputRef}
        className="nb-input"
        data-type={block.type}
        data-done={block.type === 'todo' && block.checked === true}
        rows={1}
        value={block.text}
        placeholder={block.type === 'text' ? "Write something, or press '/' for commands…" : (kindOf(block.type).placeholder ?? '')}
        aria-label={kindOf(block.type).label}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

/** One block in Notion's style: a hover handle on the left (+ to add below, ⋮⋮ to drag or open the menu), then the content. */
export function Block(props: BlockProps) {
  const { block } = props;
  return (
    <div
      className="nb"
      data-type={block.type}
      data-id={block.id}
      style={{ paddingLeft: block.indent * 24 }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(BLOCK_DRAG)) return;
        event.preventDefault();
        const half = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dataset.drop = event.clientY < half.top + half.height / 2 ? 'before' : 'after';
      }}
      onDragLeave={(event) => delete event.currentTarget.dataset.drop}
      onDrop={(event) => {
        props.onDropOn(event);
        delete event.currentTarget.dataset.drop;
      }}
    >
      <div className="nb-gutter" data-text={isTextBlock(block.type)}>
        <button className="nb-handle" aria-label="Add a block below" onClick={props.onAdd}>
          <Plus size={16} strokeWidth={1.75} />
        </button>
        <button
          className="nb-handle"
          aria-label="Drag to move, click for options"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(BLOCK_DRAG, block.id);
            event.dataTransfer.effectAllowed = 'move';
            const row = event.currentTarget.closest('.nb');
            if (row) event.dataTransfer.setDragImage(row, 0, 0);
          }}
          onClick={props.onMenu}
        >
          <GripVertical size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="nb-body">
        <Body {...props} />
      </div>
    </div>
  );
}
