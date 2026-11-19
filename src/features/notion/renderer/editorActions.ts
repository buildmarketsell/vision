import type { KeyboardEvent } from 'react';
import type { Block, BlockType, Page } from '../../../shared/pages';
import { endsList, indentBlock, insertAfter, newBlock, nextBlockAfter, removeBlock, updateBlock } from '../../../shared/pageOps';
import { isTextBlock } from './blockTypes';
import { newId } from './dbStore';
import { changePage } from './pageStore';

export type Caret = number | 'end';

/** Where focus goes after a change: applied right away, or after the new block appears on screen. */
export class FocusKeeper {
  private readonly inputs = new Map<string, HTMLTextAreaElement>();
  private waiting: { id: string; caret: Caret } | null = null;

  register(id: string, element: HTMLTextAreaElement | null): void {
    if (element) this.inputs.set(id, element);
    else this.inputs.delete(id);
  }

  /** After an edit: waits for the redraw, which would otherwise move the caret to the end. */
  focus(id: string, caret: Caret): void {
    this.waiting = { id, caret };
  }

  /** When nothing changes on screen (arrow keys). */
  focusNow(id: string, caret: Caret): void {
    const element = this.inputs.get(id);
    if (!element) return;
    element.focus();
    const at = caret === 'end' ? element.value.length : Math.min(caret, element.value.length);
    element.setSelectionRange(at, at);
  }

  /** Runs after each render. */
  applyWaiting(): void {
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) this.focusNow(waiting.id, waiting.caret);
  }
}

export const editBlocks = (pageId: string, edit: (blocks: Block[]) => Block[]): void => changePage(pageId, (page) => ({ ...page, blocks: edit(page.blocks) }));

/** The last block nested under `block` (or itself): Enter on a closed toggle adds after everything it hides. */
export function lastInside(blocks: Block[], block: Block): string {
  const start = blocks.findIndex((candidate) => candidate.id === block.id);
  let last = block.id;
  for (let index = start + 1; index < blocks.length; index += 1) {
    const next = blocks[index];
    if (!next || next.indent <= block.indent) break;
    last = next.id;
  }
  return last;
}

function isSingleLine(element: HTMLTextAreaElement): boolean {
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24;
  return element.scrollHeight < lineHeight * 1.6;
}

/** Enter, Backspace, Tab and the arrows, as Notion does them. Returns true if it handled the key. */
export function handleBlockKey(event: KeyboardEvent<HTMLTextAreaElement>, page: Page, visible: Block[], block: Block, keeper: FocusKeeper): boolean {
  const element = event.currentTarget;
  const caret = element.selectionStart;
  const caretEnd = element.selectionEnd;
  const index = visible.findIndex((candidate) => candidate.id === block.id);
  const textAbove = visible.slice(0, index).reverse().find((candidate) => isTextBlock(candidate.type));
  const textBelow = visible.slice(index + 1).find((candidate) => isTextBlock(candidate.type));
  const edit = (change: (blocks: Block[]) => Block[]) => editBlocks(page.id, change);

  if (event.key === 'Enter' && !event.shiftKey) {
    if (endsList(block)) {
      edit((blocks) => updateBlock(blocks, block.id, block.indent > 0 ? { indent: block.indent - 1 } : { type: 'text' }));
      return true;
    }
    if (caret === 0 && caretEnd === 0 && block.text !== '') {
      const above = page.blocks[page.blocks.findIndex((candidate) => candidate.id === block.id) - 1];
      edit((blocks) => insertAfter(blocks, above?.id ?? null, newBlock('text', newId, block.indent)));
      return true;
    }
    const next = nextBlockAfter(block);
    const created = newBlock(next.type, newId, next.indent, block.text.slice(caretEnd));
    const after = block.type === 'toggle' && !block.open ? lastInside(page.blocks, block) : block.id;
    edit((blocks) => insertAfter(updateBlock(blocks, block.id, { text: block.text.slice(0, caret) }), after, created));
    keeper.focus(created.id, 0);
    return true;
  }

  if (event.key === 'Backspace' && caret === 0 && caretEnd === 0) {
    if (block.type !== 'text') {
      edit((blocks) => updateBlock(blocks, block.id, { type: 'text' }));
      return true;
    }
    if (block.indent > 0) {
      edit((blocks) => indentBlock(blocks, block.id, -1));
      return true;
    }
    const above = visible[index - 1];
    if (!above) return false;
    if (isTextBlock(above.type)) {
      edit((blocks) => removeBlock(updateBlock(blocks, above.id, { text: above.text + block.text }), block.id));
      keeper.focus(above.id, above.text.length);
      return true;
    }
    if (block.text === '') {
      edit((blocks) => removeBlock(blocks, block.id));
      if (textAbove) keeper.focus(textAbove.id, 'end');
      return true;
    }
    return false;
  }

  if (event.key === 'Tab') {
    edit((blocks) => indentBlock(blocks, block.id, event.shiftKey ? -1 : 1));
    keeper.focus(block.id, caret);
    return true;
  }

  const onFirstLine = caret === 0 || (!block.text.slice(0, caret).includes('\n') && isSingleLine(element));
  if (event.key === 'ArrowUp' && onFirstLine && textAbove) {
    keeper.focusNow(textAbove.id, 'end');
    return true;
  }
  const onLastLine = caret === block.text.length || (!block.text.slice(caret).includes('\n') && isSingleLine(element));
  if (event.key === 'ArrowDown' && onLastLine && textBelow) {
    keeper.focusNow(textBelow.id, 0);
    return true;
  }
  return false;
}

/** Turns a block into another kind; a divider also gets a text block after it so writing can go on. */
export function turnInto(page: Page, block: Block, type: BlockType, keeper: FocusKeeper): void {
  if (type === 'divider') {
    const after = newBlock('text', newId, block.indent);
    editBlocks(page.id, (blocks) => insertAfter(updateBlock(blocks, block.id, { type, text: '' }), block.id, after));
    keeper.focus(after.id, 0);
    return;
  }
  editBlocks(page.id, (blocks) => updateBlock(blocks, block.id, { type, checked: false }));
  keeper.focus(block.id, 'end');
}
