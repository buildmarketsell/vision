/**
 * The Boards home, like Figma's file browser: folders are real folders on disk, shown when they hold
 * boards (at any depth) or are empty (just made). Pure, so it's unit tested without the app.
 */

import { BOARD_EXTENSION } from './boardFile';

export interface LibraryFolder {
  path: string;
  name: string;
  /** Boards inside, at any depth. */
  boardCount: number;
}

export interface LibraryView {
  folders: LibraryFolder[];
  boards: string[];
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

export function nameOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.toLowerCase().endsWith(BOARD_EXTENSION) ? name.slice(0, -BOARD_EXTENSION.length) : name;
}

const byName = (a: string, b: string) => nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true, sensitivity: 'base' });

/** Every folder between `root` and a board (not `root` itself), sorted by path. */
export function boardFolders(root: string, boards: string[]): string[] {
  const folders = new Set<string>();
  for (const board of boards) {
    for (let dir = parentOf(board); dir.length > root.length && dir.startsWith(`${root}/`); dir = parentOf(dir)) folders.add(dir);
  }
  return [...folders].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/** What one folder shows: its sub-folders that hold boards (or are empty), then its own boards, A to Z. */
export function folderView(location: string, boards: string[], emptyFolders: string[] = []): LibraryView {
  const children = new Map<string, number>();
  for (const folder of emptyFolders) if (parentOf(folder) === location) children.set(folder, 0);
  for (const board of boards) {
    if (!board.startsWith(`${location}/`)) continue;
    const rest = board.slice(location.length + 1);
    const slash = rest.indexOf('/');
    if (slash === -1) continue;
    const child = `${location}/${rest.slice(0, slash)}`;
    children.set(child, (children.get(child) ?? 0) + 1);
  }
  return {
    folders: [...children.entries()].map(([path, boardCount]) => ({ path, name: nameOf(path), boardCount })).sort((a, b) => byName(a.path, b.path)),
    boards: boards.filter((board) => parentOf(board) === location).sort(byName),
  };
}

/** Every board, the one edited last first (unknown times last). */
export function recentBoards(boards: string[], times: Record<string, number>): string[] {
  return [...boards].sort((a, b) => (times[b] ?? 0) - (times[a] ?? 0) || byName(a, b));
}

const UNITS: Array<[name: string, ms: number]> = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** Figma's wording: "Edited just now", "Edited 5 minutes ago", "Edited 2 months ago". */
export function editedLabel(modified: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - modified);
  for (const [unit, size] of UNITS) {
    const count = Math.floor(elapsed / size);
    if (count >= 1) return `Edited ${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }
  return 'Edited just now';
}

/** Root first, then each folder down to `location`, for the breadcrumb ("BUSINESS OS / ideas / reels"). */
export function breadcrumb(root: string, location: string): string[] {
  const trail = [root];
  if (!location.startsWith(`${root}/`)) return trail;
  let path = root;
  for (const part of location.slice(root.length + 1).split('/')) {
    path = `${path}/${part}`;
    trail.push(path);
  }
  return trail;
}

/** "Copy of X.excalidraw", then "Copy of X 2.excalidraw"… — the first name not in `taken`. */
export function copyName(path: string, taken: string[]): string {
  const names = new Set(taken.map((name) => name.toLowerCase()));
  const base = `Copy of ${nameOf(path)}`;
  for (let number = 1; ; number += 1) {
    const name = `${number === 1 ? base : `${base} ${number}`}${BOARD_EXTENSION}`;
    if (!names.has(name.toLowerCase())) return name;
  }
}
