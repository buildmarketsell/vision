/** Notion-style pages: a title, icon, cover and a list of blocks. Saved app-wide on this Mac next to the databases. */

export const BLOCK_TYPES = ['text', 'h1', 'h2', 'h3', 'todo', 'bullet', 'numbered', 'toggle', 'quote', 'callout', 'divider', 'page', 'database'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Blocks are a flat list; `indent` nests them (under a toggle, a list item, …) like Tab does in Notion.
 * A closed toggle hides the blocks after it that are indented deeper.
 */
export interface Block {
  id: string;
  type: BlockType;
  text: string;
  indent: number;
  /** To-do ticked. */
  checked?: boolean;
  /** Toggle open. */
  open?: boolean;
  /** The page or database a page/database block points to. */
  ref?: string;
}

export interface Page {
  id: string;
  /** Null for a top-level page. */
  parentId: string | null;
  title: string;
  /** One emoji, or empty. */
  icon: string;
  /** A cover color name, an image as a data URL, or empty for none. */
  cover: string;
  favorite: boolean;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export const COVER_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;

export const MAX_PAGES = 2_000;
export const MAX_BLOCKS = 2_000;
export const MAX_BLOCK_TEXT = 20_000;
export const MAX_INDENT = 6;
/** A cover image is shrunk before saving; this caps what a window may send. */
export const MAX_COVER_CHARS = 1_500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

function normalizeBlock(raw: unknown): Block[] {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !BLOCK_TYPES.includes(raw.type as BlockType)) return [];
  const indent = typeof raw.indent === 'number' && Number.isFinite(raw.indent) ? Math.round(Math.min(MAX_INDENT, Math.max(0, raw.indent))) : 0;
  const block: Block = { id: raw.id, type: raw.type as BlockType, text: str(raw.text, MAX_BLOCK_TEXT), indent };
  if (raw.checked === true) block.checked = true;
  if (raw.open === true) block.open = true;
  if (typeof raw.ref === 'string') block.ref = raw.ref.slice(0, 100);
  return [block];
}

function normalizeCover(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (COVER_COLORS.includes(value as (typeof COVER_COLORS)[number])) return value;
  return /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= MAX_COVER_CHARS ? value : '';
}

export function normalizePage(raw: unknown): Page | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    title: str(raw.title, 500),
    icon: str(raw.icon, 16),
    cover: normalizeCover(raw.cover),
    favorite: raw.favorite === true,
    blocks: Array.isArray(raw.blocks) ? raw.blocks.flatMap(normalizeBlock).slice(0, MAX_BLOCKS) : [],
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

/** Pages whose parent is gone become top-level, so nothing is ever unreachable. */
export function normalizePages(raw: unknown): Page[] {
  if (!Array.isArray(raw)) return [];
  const pages = raw.flatMap((item) => normalizePage(item) ?? []).slice(0, MAX_PAGES);
  const ids = new Set(pages.map((page) => page.id));
  return pages.map((page) => (page.parentId && !ids.has(page.parentId) ? { ...page, parentId: null } : page));
}

/** A page and everything under it, for deleting. */
export function withDescendants(pages: Page[], id: string): Set<string> {
  const found = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const page of pages) {
      if (page.parentId && found.has(page.parentId) && !found.has(page.id)) {
        found.add(page.id);
        grew = true;
      }
    }
  }
  return found;
}
