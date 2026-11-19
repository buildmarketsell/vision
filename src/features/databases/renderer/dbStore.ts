import { useEffect } from 'react';
import { create } from 'zustand';
import type { Database } from '../../../shared/databases';
import { createDatabase } from '../../../shared/databaseOps';
import { openPageTab } from '../../../renderer/core/dockActions';

export const DATABASE_TAB = 'database';
export const newId = (): string => crypto.randomUUID();

interface DbState {
  /** Null while loading. */
  databases: Database[] | null;
  error: string | null;
  /** Applies an edit on screen at once, then saves it. */
  change: (id: string, edit: (db: Database) => Database) => void;
  create: (name?: string) => Database;
  remove: (id: string) => void;
}

/** Saves still on their way. While any are, broadcasts are older than the screen and are skipped. */
let pending = 0;
function persist(action: Promise<Database[]>): void {
  pending += 1;
  action
    .catch(() => useDatabases.setState({ error: 'That did not save. Try again.' }))
    .finally(() => {
      pending -= 1;
    });
}

export const useDatabases = create<DbState>((set, get) => ({
  databases: null,
  error: null,
  change: (id, edit) => {
    const current = get().databases?.find((db) => db.id === id);
    if (!current) return;
    const next = edit(current);
    if (next === current) return;
    set({ error: null, databases: get().databases?.map((db) => (db.id === id ? next : db)) ?? null });
    persist(window.vision.databases.save(next));
  },
  create: (name = 'Untitled') => {
    const db = createDatabase(name, newId, Date.now());
    set({ error: null, databases: [...(get().databases ?? []), db] });
    persist(window.vision.databases.save(db));
    return db;
  },
  remove: (id) => {
    set({ databases: get().databases?.filter((db) => db.id !== id) ?? null });
    persist(window.vision.databases.remove(id));
  },
}));

let subscribed = false;

/** Loads the databases once and keeps every window in sync. */
export function useDatabaseList() {
  useEffect(() => {
    if (subscribed) return;
    subscribed = true;
    window.vision.databases.list().then(
      (databases) => useDatabases.setState({ databases }),
      () => useDatabases.setState({ error: 'Could not load your databases.' }),
    );
    window.vision.databases.onChange((databases) => pending === 0 && useDatabases.setState({ databases }));
  }, []);
  return useDatabases();
}

export function openDatabase(db: Database): void {
  openPageTab(`database:${db.id}`, DATABASE_TAB, db.name || 'Untitled', { id: db.id });
}
