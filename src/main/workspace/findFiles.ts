import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, sep } from 'node:path';
import type { Result } from '../../shared/ipc';
import { fileMention } from '../../shared/fileMentions';
import { isInsideFolder } from '../paths';

/** Enough for any real folder; a huge one (a home folder) stops here instead of freezing the app. */
const MAX_RESULTS = 500;
const MAX_FOLDERS = 5000;
const SKIPPED_FOLDERS = new Set(['node_modules']);

/** ".excalidraw", ".md": a dot, then letters and digits only, so nothing path-like gets through. */
export function isFileExtension(value: unknown): value is string {
  return typeof value === 'string' && /^\.[a-z0-9]{1,16}$/i.test(value);
}

/** Files under `root` that `matches` accepts, shallowest folders first, skipping hidden folders and node_modules. */
async function walkFiles(root: string, matches: (path: string) => boolean, maxResults: number): Promise<Result<string[]>> {
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
      if (dirent.isDirectory() && !SKIPPED_FOLDERS.has(dirent.name)) queue.push(path);
      else if (dirent.isFile() && matches(path) && found.length < maxResults) found.push(path);
    }
  }
  return { ok: true, value: found };
}

/** Every file under `root` ending in `extension`, sorted. */
export async function findFiles(root: string, extension: string): Promise<Result<string[]>> {
  const wanted = extension.toLowerCase();
  const result = await walkFiles(root, (path) => path.toLowerCase().endsWith(wanted), MAX_RESULTS);
  if (!result.ok) return result;
  return { ok: true, value: result.value.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) };
}

async function isFile(path: string): Promise<boolean> {
  return stat(path).then((info) => info.isFile(), () => false);
}

/**
 * The file a chat mention points at, inside `folder`: an absolute or `~/` path, a path from the folder,
 * or (Claude often writes just the name) the shallowest file whose path ends with the mention.
 */
export async function locateFile(folder: string, text: unknown): Promise<string | null> {
  const mention = typeof text === 'string' ? fileMention(text) : null;
  if (!mention) return null;
  const expanded = mention.startsWith('~/') ? join(homedir(), mention.slice(2)) : mention;
  if (isAbsolute(expanded)) return isInsideFolder(folder, expanded) && (await isFile(expanded)) ? expanded : null;
  const fromFolder = join(folder, expanded);
  if (isInsideFolder(folder, fromFolder) && (await isFile(fromFolder))) return fromFolder;
  const tail = `${sep}${expanded.replace(/^\.\//, '')}`;
  const found = await walkFiles(folder, (path) => path.endsWith(tail), 1);
  return found.ok ? (found.value[0] ?? null) : null;
}
