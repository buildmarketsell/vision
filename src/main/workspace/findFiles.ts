import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, sep } from 'node:path';
import type { LocatedPath, Result } from '../../shared/ipc';
import { fileMention } from '../../shared/fileMentions';
import { matchesAll, rankHits, searchWords, type SearchHit } from '../../shared/fileSearch';
import { isInsideFolder } from '../paths';

/** Enough for any real folder; a huge one (a home folder) stops here instead of freezing the app. */
const MAX_RESULTS = 500;
const MAX_FOLDERS = 5000;
const SKIPPED_FOLDERS = new Set(['node_modules']);

/** ".excalidraw", ".md": a dot, then letters and digits only, so nothing path-like gets through. */
export function isFileExtension(value: unknown): value is string {
  return typeof value === 'string' && /^\.[a-z0-9]{1,16}$/i.test(value);
}

/** Files (and folders, if `matches` takes them) under `root`, shallowest first, skipping hidden folders and node_modules. */
async function walkFiles(root: string, matches: (path: string, isDirectory: boolean) => boolean, maxResults: number): Promise<Result<string[]>> {
  const found: string[] = [];
  const queue = [root];
  let visited = 0;
  while (queue.length > 0 && found.length < maxResults && visited < MAX_FOLDERS) {
    const dir = queue.shift() as string;
    visited += 1;
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      // The root itself failing is an error; an unreadable subfolder is just skipped.
      if (dir === root) return { ok: false, error: error instanceof Error ? error.message : 'The folder could not be read.' };
      continue;
    }
    for (const dirent of dirents) {
      if (dirent.name.startsWith('.')) continue;
      const path = join(dir, dirent.name);
      const isDirectory = dirent.isDirectory() && !SKIPPED_FOLDERS.has(dirent.name);
      if (isDirectory) queue.push(path);
      if ((isDirectory || dirent.isFile()) && matches(path, isDirectory) && found.length < maxResults) found.push(path);
    }
  }
  return { ok: true, value: found };
}

/** Every file under `root` ending in `extension`, sorted. */
export async function findFiles(root: string, extension: string): Promise<Result<string[]>> {
  const wanted = extension.toLowerCase();
  const result = await walkFiles(root, (path, isDirectory) => !isDirectory && path.toLowerCase().endsWith(wanted), MAX_RESULTS);
  if (!result.ok) return result;
  return { ok: true, value: result.value.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) };
}

/** Enough matches to rank well; the walk stops here on a very broad search like "a". */
const MAX_SEARCH_MATCHES = 2000;

/** Files and folders under `folder` whose path from the folder contains every word typed, best first. */
export async function searchFolder(folder: string, query: unknown): Promise<Result<SearchHit[]>> {
  const words = searchWords(query);
  if (!words) return { ok: true, value: [] };
  const folders = new Set<string>();
  const found = await walkFiles(
    folder,
    (path, isDirectory) => {
      const hit = matchesAll(path.slice(folder.length + 1), words);
      if (hit && isDirectory) folders.add(path);
      return hit;
    },
    MAX_SEARCH_MATCHES,
  );
  if (!found.ok) return found;
  const hits = found.value.map((path) => ({ path, relative: path.slice(folder.length + 1), isDirectory: folders.has(path) }));
  return { ok: true, value: rankHits(hits, words) };
}

async function kindOf(path: string): Promise<LocatedPath | null> {
  return stat(path).then(
    (info) => (info.isFile() || info.isDirectory() ? { path, isDirectory: info.isDirectory() } : null),
    () => null,
  );
}

/**
 * The file or folder a chat mention points at, inside `folder`: an absolute or `~/` path, a path from the folder,
 * or (Claude often writes just the name) the shallowest entry whose path ends with the mention.
 */
export async function locatePath(folder: string, text: unknown): Promise<LocatedPath | null> {
  const mention = typeof text === 'string' ? fileMention(text) : null;
  if (!mention) return null;
  const trimmed = mention.length > 1 ? mention.replace(/\/+$/, '') : mention;
  const expanded = trimmed.startsWith('~/') ? join(homedir(), trimmed.slice(2)) : trimmed;
  if (isAbsolute(expanded)) return isInsideFolder(folder, expanded) ? kindOf(expanded) : null;
  const fromFolder = join(folder, expanded);
  if (isInsideFolder(folder, fromFolder)) {
    const direct = await kindOf(fromFolder);
    if (direct) return direct;
  }
  const tail = `${sep}${expanded.replace(/^\.\//, '')}`;
  const wantsFolder = mention.endsWith('/');
  const found = await walkFiles(folder, (path, isDirectory) => path.endsWith(tail) && (isDirectory || !wantsFolder), 1);
  return found.ok && found.value[0] ? kindOf(found.value[0]) : null;
}
