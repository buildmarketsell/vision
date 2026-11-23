import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createDocumentStore } from './documentStore';
import { logError } from './log';

export interface JsonListStore<T> {
  load(): T[];
  /** Saves and tells every window; returns the new list. */
  commit(next: T[]): T[];
  /** Calls `listener` after every change made in VISION. */
  onCommit(listener: (items: T[]) => void): void;
}

/** An app-wide list saved as JSON in userData (inbox, to-dos, pages, databases); every window hears about each change. */
export function createJsonListStore<T>(fileName: string, normalize: (raw: unknown) => T[], changedChannel: string): JsonListStore<T> {
  const document = createDocumentStore<T[]>({ path: () => join(app.getPath('userData'), fileName), read: normalize });
  document.onChange((items) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) window.webContents.send(changedChannel, items);
    }
  });

  const commit = (next: T[]): T[] => {
    document.set(next).catch((error: unknown) => logError(`Could not save ${fileName}`, error));
    return next;
  };

  return { load: document.get, commit, onCommit: document.onChange };
}
