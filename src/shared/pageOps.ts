/** Edits to pages and their blocks. Pure; ids come from `newId` so tests can fix them. */
import { MAX_INDENT, type Block, type BlockType, type Page } from './pages';

type NewId = () => string;

export function createPage(parentId: string | null, newId: NewId, now: number, title = ''): Page {
  return { id: newId(), parentId, title, icon: '', cover: '', favorite: false, blocks: [{ id: newId(), type: 'text', text: '', indent: 0 }], createdAt: now, updatedAt: now };
}

export const newBlock = (type: BlockType, newId: NewId, indent = 0, text = ''): Block => ({ id: newId(), type, text, indent });

/** Notion's markdown shortcuts, typed at the start of a block and finished with a space. */
const SHORTCUTS: Array<[string, BlockType]> = [
  ['#', 'h1'],
  ['##', 'h2'],
  ['###', 'h3'],
  ['-', 'bullet'],
  ['*', 'bullet'],
  ['+', 'bullet'],
  ['1.', 'numbered'],
  ['[]', 'todo'],
  ['>', 'toggle'],
  ['"', 'quote'],
  ['|', 'quote'],
];

/** The block type a just-typed prefix turns the block into, or null. `text` is the block's text after the keystroke. */
export function shortcutFor(text: string): { type: BlockType; text: string } | null {
  if (text === '---') return { type: 'divider', text: '' };
  const match = /^(\S+) /.exec(text);
  if (!match) return null;
  const found = SHORTCUTS.find(([prefix]) => prefix === match[1]);
  return found ? { type: found[1], text: text.slice(match[0].length) } : null;
}

const LIST_TYPES: BlockType[] = ['todo', 'bullet', 'numbered'];

/**
 * What Enter makes after a block: lists continue as lists, an open toggle gets a child inside it,
 * everything else gives plain text at the same depth.
 */
export function nextBlockAfter(block: Block): { type: BlockType; indent: number } {
  if (LIST_TYPES.includes(block.type)) return { type: block.type, indent: block.indent };
  if (block.type === 'toggle' && block.open) return { type: 'text', indent: Math.min(MAX_INDENT, block.indent + 1) };
  return { type: 'text', indent: block.indent };
}

/** Enter on an empty list item ends the list (Notion turns it back into text). */
export const endsList = (block: Block): boolean => block.text === '' && (LIST_TYPES.includes(block.type) || block.type === 'toggle' || block.type === 'quote');

export const updateBlock = (blocks: Block[], id: string, patch: Partial<Block>): Block[] => blocks.map((block) => (block.id === id ? { ...block, ...patch } : block));

export function insertAfter(blocks: Block[], afterId: string | null, block: Block): Block[] {
  const index = afterId === null ? -1 : blocks.findIndex((candidate) => candidate.id === afterId);
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}

export const removeBlock = (blocks: Block[], id: string): Block[] => blocks.filter((block) => block.id !== id);

/** Moves a block (and the blocks nested under it) to just before `beforeId`, or to the end. */
export function moveBlock(blocks: Block[], id: string, beforeId: string | null): Block[] {
  const start = blocks.findIndex((block) => block.id === id);
  const head = blocks[start];
  if (!head || id === beforeId) return blocks;
  let end = start + 1;
  while (end < blocks.length && (blocks[end]?.indent ?? 0) > head.indent) end += 1;
  const moving = blocks.slice(start, end);
  if (beforeId && moving.some((block) => block.id === beforeId)) return blocks;
  const rest = [...blocks.slice(0, start), ...blocks.slice(end)];
  const at = beforeId === null ? rest.length : rest.findIndex((block) => block.id === beforeId);
  return at < 0 ? blocks : [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}

/** Tab nests a block one level deeper, but never more than one deeper than the block above it. */
export function indentBlock(blocks: Block[], id: string, delta: 1 | -1): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  const block = blocks[index];
  if (!block) return blocks;
  const above = blocks[index - 1];
  const limit = above ? Math.min(MAX_INDENT, above.indent + 1) : 0;
  const indent = Math.max(0, Math.min(limit, block.indent + delta));
  return indent === block.indent ? blocks : updateBlock(blocks, id, { indent });
}

/** Blocks on screen: anything nested under a closed toggle is hidden. */
export function visibleBlocks(blocks: Block[]): Block[] {
  const shown: Block[] = [];
  let hideDeeperThan: number | null = null;
  for (const block of blocks) {
    if (hideDeeperThan !== null && block.indent > hideDeeperThan) continue;
    hideDeeperThan = block.type === 'toggle' && !block.open ? block.indent : null;
    shown.push(block);
  }
  return shown;
}

/** The number each numbered item shows: counting restarts after anything else at the same depth. */
export function listNumbers(blocks: Block[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const counters: number[] = [];
  for (const block of blocks) {
    counters.length = block.indent + 1;
    if (block.type === 'numbered') {
      const next = (counters[block.indent] ?? 0) + 1;
      counters[block.indent] = next;
      numbers.set(block.id, next);
    } else {
      counters[block.indent] = 0;
    }
  }
  return numbers;
}

/** The page and its parents, top first, for the breadcrumb. */
export function pagePath(pages: Page[], id: string): Page[] {
  const path: Page[] = [];
  const seen = new Set<string>();
  let current = pages.find((page) => page.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    const parentId: string | null = current.parentId;
    current = parentId ? pages.find((page) => page.id === parentId) : undefined;
  }
  return path;
}

export const pageTitle = (page: Pick<Page, 'title'> | undefined): string => page?.title.trim() || 'Untitled';
