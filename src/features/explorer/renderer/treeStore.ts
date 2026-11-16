import { create } from 'zustand';
import type { DirEntry } from '../../../shared/ipc';

export type DirListing =
  | { status: 'loading' }
  | { status: 'ready'; entries: DirEntry[] }
  | { status: 'error'; error: string };

/** What the inline name box is doing right now. */
export type TreeEdit =
  | { mode: 'rename'; path: string; name: string }
  | { mode: 'newFile' | 'newDir'; parent: string }
  | null;

interface TreeState {
  listings: Record<string, DirListing>;
  expanded: Set<string>;
  selected: string | null;
  edit: TreeEdit;
  notice: string | null;
  loadDir: (dir: string) => Promise<void>;
  toggle: (dir: string) => void;
  expand: (dir: string) => void;
  forget: (dir: string) => void;
  collapseAll: () => void;
  /** Lists the root and every open folder again. */
  refresh: (root: string) => Promise<void>;
  select: (path: string | null) => void;
  setEdit: (edit: TreeEdit) => void;
  setNotice: (notice: string | null) => void;
  reset: () => void;
}

export const useTree = create<TreeState>((set, get) => ({
  listings: {},
  expanded: new Set(),
  selected: null,
  edit: null,
  notice: null,

  loadDir: async (dir) => {
    if (!get().listings[dir]) set((state) => ({ listings: { ...state.listings, [dir]: { status: 'loading' } } }));
    const result = await window.vision.fs.listDir(dir);
    const listing: DirListing = result.ok ? { status: 'ready', entries: result.value } : { status: 'error', error: result.error };
    set((state) => ({ listings: { ...state.listings, [dir]: listing } }));
  },

  toggle: (dir) => {
    if (get().expanded.has(dir)) {
      const expanded = new Set(get().expanded);
      expanded.delete(dir);
      set({ expanded });
    } else {
      get().expand(dir);
    }
  },

  expand: (dir) => {
    if (get().expanded.has(dir)) return;
    set((state) => ({ expanded: new Set(state.expanded).add(dir) }));
    void get().loadDir(dir);
  },

  /** Drops a folder (and everything below it) after it was deleted or renamed. */
  forget: (dir) => {
    const isInside = (path: string) => path === dir || path.startsWith(`${dir}/`);
    const listings = Object.fromEntries(Object.entries(get().listings).filter(([path]) => !isInside(path)));
    const expanded = new Set([...get().expanded].filter((path) => !isInside(path)));
    set({ listings, expanded });
  },

  collapseAll: () => set({ expanded: new Set() }),

  refresh: async (root) => {
    await Promise.all([root, ...get().expanded].map((dir) => get().loadDir(dir)));
  },

  select: (path) => set({ selected: path }),
  setEdit: (edit) => set({ edit }),
  setNotice: (notice) => set({ notice }),
  reset: () => set({ listings: {}, expanded: new Set(), selected: null, edit: null, notice: null }),
}));
