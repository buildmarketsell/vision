import { app, BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logError } from './log';

export interface JsonListStore<T> {
  load(): T[];
  /** Saves and tells every window; returns the new list. */
  commit(next: T[]): T[];
  /** Calls `listener` after every change made in VISION. */
  onCommit(listener: (items: T[]) => void): void;
}

/**
 * An app-wide list saved as JSON in userData (inbox, to-dos). Read once, then kept in memory.
 * Saves through a temp file (a crash never leaves half a file), one write at a time.
 */
export function createJsonListStore<T>(fileName: string, normalize: (raw: unknown) => T[], changedChannel: string): JsonListStore<T> {
  let items: T[] | null = null;
  let writing: Promise<void> = Promise.resolve();
  const listeners: Array<(items: T[]) => void> = [];
  const filePath = () => join(app.getPath('userData'), fileName);

  const load = (): T[] => {
    if (items) return items;
    try {
      items = normalize(JSON.parse(readFileSync(filePath(), 'utf8')));
    } catch {
      items = [];
    }
    return items;
  };

  const commit = (next: T[]): T[] => {
    items = next;
    const snapshot = JSON.stringify(next, null, 2);
    writing = writing.then(async () => {
      try {
        await writeFile(`${filePath()}.tmp`, snapshot, 'utf8');
        await rename(`${filePath()}.tmp`, filePath());
      } catch (error) {
        logError(`Could not save ${fileName}`, error);
      }
    });
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) window.webContents.send(changedChannel, next);
    }
    for (const listener of listeners) listener(next);
    return next;
  };

  return { load, commit, onCommit: (listener) => listeners.push(listener) };
}
