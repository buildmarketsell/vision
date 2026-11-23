/** Matching and labels for the ⌘K search box. Pure, so it is unit tested. */
import { normalizeForSearch, searchWords } from './fileSearch';

export interface Searchable {
  title: string;
  detail?: string;
}

/** Lower is better; null = not a match. Every typed word must appear in the title or detail. */
export function matchScore(item: Searchable, query: string): number | null {
  const words = searchWords(query);
  if (!words) return null;
  const title = normalizeForSearch(item.title);
  const all = `${title} ${normalizeForSearch(item.detail ?? '')}`;
  if (!words.every((word) => all.includes(word))) return null;
  const joined = words.join(' ');
  if (title === joined) return 0;
  if (title.startsWith(joined)) return 1;
  const starts = title.split(/[\s\-_/.]+/);
  if (words.every((word) => starts.some((part) => part.startsWith(word)))) return 2;
  if (words.every((word) => title.includes(word))) return 3;
  return 4;
}

/** The items that match, best first; equal scores keep their order. */
export function rankItems<T extends Searchable>(items: T[], query: string, limit = Infinity): T[] {
  return items
    .map((item, index) => ({ item, index, score: matchScore(item, query) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

const KEY_SYMBOLS: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };

/** "Mod+Shift+." → "⌘⇧." as macOS menus show it. */
export function shortcutLabel(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part, index, parts) => (index < parts.length - 1 ? (KEY_SYMBOLS[part] ?? part) : part.toUpperCase()))
    .join('');
}
