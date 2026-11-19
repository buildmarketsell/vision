import { create } from 'zustand';
import { withDescendants, type Page } from '../../../shared/pages';
import { createPage } from '../../../shared/pageOps';
import { createSyncedList } from './syncedList';
import { newId } from './dbStore';

export const pages = createSyncedList<Page>(() => window.vision.pages, 'Could not load your pages.');

export function addPage(parentId: string | null, title = ''): Page {
  const page = createPage(parentId, newId, Date.now(), title);
  pages.add(page);
  return page;
}

const TYPING_SAVE_MS = 300;

export function changePage(id: string, edit: (page: Page) => Page): void {
  pages.change(
    id,
    (page) => {
      const next = edit(page);
      return next === page ? page : { ...next, updatedAt: Date.now() };
    },
    TYPING_SAVE_MS,
  );
}

export function removePage(id: string): void {
  pages.remove(id, withDescendants(pages.useStore.getState().items ?? [], id));
}

export type Target = { kind: 'page' | 'database'; id: string };
const CURRENT_KEY = 'vision.notionCurrent';

function readCurrent(): Target | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CURRENT_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const { kind, id } = raw as Record<string, unknown>;
    return (kind === 'page' || kind === 'database') && typeof id === 'string' ? { kind, id } : null;
  } catch {
    return null;
  }
}

function remember(target: Target | null): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(target));
  } catch {
    // Not remembering the open page is fine.
  }
}

const same = (a: Target | null, b: Target | null) => a?.kind === b?.kind && a?.id === b?.id;

/** What the Notion view shows, with Notion's back and forward arrows. */
export const useNav = create<{
  current: Target | null;
  back: Target[];
  forward: Target[];
  open: (target: Target) => void;
  goBack: () => void;
  goForward: () => void;
}>((set, get) => ({
  current: readCurrent(),
  back: [],
  forward: [],
  open: (target) => {
    const { current, back } = get();
    if (same(current, target)) return;
    remember(target);
    set({ current: target, back: current ? [...back, current].slice(-50) : back, forward: [] });
  },
  goBack: () => {
    const { current, back, forward } = get();
    const previous = back.at(-1);
    if (!previous) return;
    remember(previous);
    set({ current: previous, back: back.slice(0, -1), forward: current ? [current, ...forward] : forward });
  },
  goForward: () => {
    const { current, back, forward } = get();
    const next = forward[0];
    if (!next) return;
    remember(next);
    set({ current: next, forward: forward.slice(1), back: current ? [...back, current] : back });
  },
}));
