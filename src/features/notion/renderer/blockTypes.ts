import { CheckSquare, ChevronRight, FileText, Heading1, Heading2, Heading3, Lightbulb, List, ListOrdered, Minus, Quote, Table2, Type } from 'lucide-react';
import type { BlockType } from '../../../shared/pages';

export interface BlockKind {
  type: BlockType;
  label: string;
  hint: string;
  icon: typeof Type;
  /** Other words the "/" menu matches. */
  keywords: string;
  placeholder?: string;
}

/** Notion's "/" menu, in its order. */
export const BLOCK_KINDS: BlockKind[] = [
  { type: 'text', label: 'Text', hint: 'Just start writing with plain text.', icon: Type, keywords: 'paragraph plain' },
  { type: 'page', label: 'Page', hint: 'Embed a sub-page inside this page.', icon: FileText, keywords: 'subpage link' },
  { type: 'todo', label: 'To-do list', hint: 'Track tasks with a to-do list.', icon: CheckSquare, keywords: 'checkbox task todo', placeholder: 'To-do' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section heading.', icon: Heading1, keywords: 'title h1 #', placeholder: 'Heading 1' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section heading.', icon: Heading2, keywords: 'subtitle h2 ##', placeholder: 'Heading 2' },
  { type: 'h3', label: 'Heading 3', hint: 'Small section heading.', icon: Heading3, keywords: 'h3 ###', placeholder: 'Heading 3' },
  { type: 'bullet', label: 'Bulleted list', hint: 'Create a simple bulleted list.', icon: List, keywords: 'bullet unordered ul', placeholder: 'List' },
  { type: 'numbered', label: 'Numbered list', hint: 'Create a list with numbering.', icon: ListOrdered, keywords: 'number ordered ol', placeholder: 'List' },
  { type: 'toggle', label: 'Toggle list', hint: 'Toggles can hide and show content inside.', icon: ChevronRight, keywords: 'toggle collapse', placeholder: 'Toggle' },
  { type: 'quote', label: 'Quote', hint: 'Capture a quote.', icon: Quote, keywords: 'quote blockquote', placeholder: 'Quote' },
  { type: 'callout', label: 'Callout', hint: 'Make writing stand out.', icon: Lightbulb, keywords: 'callout note box' },
  { type: 'divider', label: 'Divider', hint: 'Visually divide blocks.', icon: Minus, keywords: 'divider line hr separator' },
  { type: 'database', label: 'Database', hint: 'Add a table or board to this page.', icon: Table2, keywords: 'table board database inline' },
];

export const kindOf = (type: BlockType): BlockKind => BLOCK_KINDS.find((kind) => kind.type === type) ?? (BLOCK_KINDS[0] as BlockKind);

/** Blocks you type into. Page, database and divider blocks are objects instead. */
export const isTextBlock = (type: BlockType): boolean => type !== 'page' && type !== 'database' && type !== 'divider';

export function matchKinds(query: string): BlockKind[] {
  const words = query.trim().toLowerCase();
  if (!words) return BLOCK_KINDS;
  return BLOCK_KINDS.filter((kind) => `${kind.label} ${kind.keywords}`.toLowerCase().includes(words));
}
