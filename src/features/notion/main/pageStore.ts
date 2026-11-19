import { ipcMain } from 'electron';
import { IPC } from '../../../shared/ipc';
import { MAX_PAGES, normalizePage, normalizePages, withDescendants, type Page } from '../../../shared/pages';
import { createJsonListStore } from '../../../main/jsonListStore';

const store = createJsonListStore<Page>('pages.json', normalizePages, IPC.pagesChanged);

export function registerPages(): void {
  const { load, commit } = store;
  ipcMain.handle(IPC.pagesList, () => load());

  // The window sends the whole page; it is checked again here like anything from outside.
  ipcMain.handle(IPC.pagesSave, (_event, raw: unknown) => {
    const page = normalizePage(raw);
    if (!page) return load();
    const current = load();
    const exists = current.some((item) => item.id === page.id);
    if (!exists && current.length >= MAX_PAGES) return current;
    return commit(exists ? current.map((item) => (item.id === page.id ? page : item)) : [...current, page]);
  });

  ipcMain.handle(IPC.pagesRemove, (_event, id: unknown) => {
    if (typeof id !== 'string') return load();
    const current = load();
    const gone = withDescendants(current, id);
    return commit(current.filter((page) => !gone.has(page.id)));
  });
}
