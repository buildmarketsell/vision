/** Searching file and folder names in the open folder (the magnifier in the Files header, ⌘P). */

export interface SearchHit {
  path: string;
  /** Path from the open folder, e.g. "🛒 NURVE/store/CLAUDE.md". */
  relative: string;
  isDirectory: boolean;
}

export const MAX_SEARCH_HITS = 100;

/** Lowercase, without accents, so "codigo" finds "código". */
export const normalizeForSearch = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** The words typed, or null when there is nothing to search for. */
export function searchWords(query: unknown): string[] | null {
  if (typeof query !== 'string' || query.length > 200) return null;
  const words = normalizeForSearch(query).split(/[\s/]+/).filter(Boolean);
  return words.length > 0 ? words : null;
}

/** Every word appears somewhere in the path, so "nurve claude" finds "🛒 NURVE/store/CLAUDE.md". */
export const matchesAll = (relative: string, words: string[]) => {
  const text = normalizeForSearch(relative);
  return words.every((word) => text.includes(word));
};

const nameOf = (relative: string) => relative.slice(relative.lastIndexOf('/') + 1);

/** Lower is better: the name is exactly the search, starts with it, contains every word, or only the path does. */
function score(hit: SearchHit, words: string[]): number {
  const name = normalizeForSearch(nameOf(hit.relative));
  const bare = name.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\.[^.]+$/, '');
  const joined = words.join(' ');
  if (bare === joined || name === joined) return 0;
  if (bare.startsWith(words[0] ?? '')) return 1;
  if (words.every((word) => name.includes(word))) return 2;
  return 3;
}

/** Best matches first; ties go to the shallower, then shorter, then alphabetical path. */
export function rankHits(hits: SearchHit[], words: string[]): SearchHit[] {
  const depth = (hit: SearchHit) => hit.relative.split('/').length;
  return hits
    .map((hit) => ({ hit, score: score(hit, words) }))
    .sort((a, b) => a.score - b.score || depth(a.hit) - depth(b.hit) || a.hit.relative.length - b.hit.relative.length || a.hit.relative.localeCompare(b.hit.relative))
    .map(({ hit }) => hit)
    .slice(0, MAX_SEARCH_HITS);
}
