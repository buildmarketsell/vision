import { create } from 'zustand';

interface TabStatusState {
  /** Ids of tabs with unsaved changes (shown as a dot in the tab). */
  dirtyTabs: Set<string>;
  setDirty: (tabId: string, dirty: boolean) => void;
}

export const useTabStatus = create<TabStatusState>((set) => ({
  dirtyTabs: new Set(),
  setDirty: (tabId, dirty) =>
    set((state) => {
      if (state.dirtyTabs.has(tabId) === dirty) return state;
      const next = new Set(state.dirtyTabs);
      if (dirty) next.add(tabId);
      else next.delete(tabId);
      return { dirtyTabs: next };
    }),
}));
