import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '../../shared/ipc';

/** Enough for any real folder; a huge one (a home folder) stops here instead of freezing the app. */
const MAX_RESULTS = 500;
const MAX_FOLDERS = 5000;
const SKIPPED_FOLDERS = new Set(['node_modules']);

/** ".excalidraw", ".md": a dot, then letters and digits only, so nothing path-like gets through. */
export function isFileExtension(value: unknown): value is string {
  return typeof value === 'string' && /^\.[a-z0-9]{1,16}$/i.test(value);
}

/** Every file under `root` ending in `extension`, sorted, skipping hidden folders and node_modules. */
export async function findFiles(root: string, extension: string): Promise<Result<string[]>> {
  const wanted = extension.toLowerCase();
  const found: string[] = [];
  const queue = [root];
  let visited = 0;
  while (queue.length > 0 && found.length < MAX_RESULTS && visited < MAX_FOLDERS) {
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
      else if (dirent.isFile() && dirent.name.toLowerCase().endsWith(wanted)) found.push(path);
    }
  }
  return { ok: true, value: found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) };
}
