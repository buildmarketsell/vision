import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC } from '../../../shared/ipc';
import { cleanInboxText, MAX_INBOX_MESSAGES, normalizeInbox, type InboxMessage } from '../../../shared/inbox';
import { createJsonListStore } from '../../../main/jsonListStore';

const store = createJsonListStore<InboxMessage>('inbox.json', normalizeInbox, IPC.inboxChanged);

export function registerInbox(): void {
  const { load, commit } = store;
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
