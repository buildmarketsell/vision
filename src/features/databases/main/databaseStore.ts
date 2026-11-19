import { ipcMain } from 'electron';
import { IPC } from '../../../shared/ipc';
import { MAX_DATABASES, normalizeDatabase, normalizeDatabases, type Database } from '../../../shared/databases';
import { createJsonListStore } from '../../../main/jsonListStore';

const store = createJsonListStore<Database>('databases.json', normalizeDatabases, IPC.databasesChanged);

export function registerDatabases(): void {
  const { load, commit } = store;
  ipcMain.handle(IPC.databasesList, () => load());

  // The window sends the whole database; it is checked again here like anything from outside.
  ipcMain.handle(IPC.databasesSave, (_event, raw: unknown) => {
    const database = normalizeDatabase(raw);
    if (!database) return load();
    const current = load();
    const exists = current.some((item) => item.id === database.id);
    if (!exists && current.length >= MAX_DATABASES) return current;
    return commit(exists ? current.map((item) => (item.id === database.id ? database : item)) : [...current, database]);
  });

  ipcMain.handle(IPC.databasesRemove, (_event, id: unknown) => {
    if (typeof id !== 'string') return load();
    return commit(load().filter((item) => item.id !== id));
  });
}
