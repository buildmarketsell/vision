import { app, BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IPC } from '../../../shared/ipc';
import { cleanInboxText, MAX_INBOX_MESSAGES, normalizeInbox, type InboxMessage } from '../../../shared/inbox';
import { logError } from '../../../main/log';

let messages: InboxMessage[] | null = null;
let writing: Promise<void> = Promise.resolve();

function inboxPath(): string {
  return join(app.getPath('userData'), 'inbox.json');
}

function load(): InboxMessage[] {
  if (messages) return messages;
  try {
    messages = normalizeInbox(JSON.parse(readFileSync(inboxPath(), 'utf8')));
  } catch {
    messages = [];
  }
  return messages;
}

/** Saves through a temp file (a crash never leaves half a file), one write at a time, and tells every window. */
function commit(next: InboxMessage[]): InboxMessage[] {
  messages = next;
  const snapshot = JSON.stringify(next, null, 2);
  writing = writing.then(async () => {
    try {
      await writeFile(`${inboxPath()}.tmp`, snapshot, 'utf8');
      await rename(`${inboxPath()}.tmp`, inboxPath());
    } catch (error) {
      logError('Could not save the inbox', error);
    }
  });
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send(IPC.inboxChanged, next);
  }
  return next;
}

export function registerInbox(): void {
  ipcMain.handle(IPC.inboxList, () => load());

  ipcMain.handle(IPC.inboxAdd, (_event, text: unknown) => {
    const clean = cleanInboxText(text);
    if (!clean) return load();
    const message: InboxMessage = { id: randomUUID(), text: clean, createdAt: Date.now(), done: false };
    return commit([...load(), message].slice(-MAX_INBOX_MESSAGES));
  });

  ipcMain.handle(IPC.inboxSetDone, (_event, id: unknown, done: unknown) => {
    if (typeof id !== 'string' || typeof done !== 'boolean') return load();
    return commit(load().map((message) => (message.id === id ? { ...message, done } : message)));
  });

  ipcMain.handle(IPC.inboxRemove, (_event, id: unknown) => {
    if (typeof id !== 'string') return load();
    return commit(load().filter((message) => message.id !== id));
  });
}
