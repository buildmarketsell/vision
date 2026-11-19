import type { Database } from '../../../shared/databases';
import { createDatabase } from '../../../shared/databaseOps';
import { createSyncedList } from './syncedList';

export const DATABASE_TAB = 'database';
export const newId = (): string => crypto.randomUUID();

export const databases = createSyncedList<Database>(() => window.vision.databases, 'Could not load your databases.');

export function createDb(name = 'Untitled'): Database {
  const db = createDatabase(name, newId, Date.now());
  databases.add(db);
  return db;
}
