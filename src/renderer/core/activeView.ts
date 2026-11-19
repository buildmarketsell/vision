import { create } from 'zustand';

const ACTIVE_VIEW_KEY = 'vision.sidebarView';

function readStoredView(): string | null {
  try {
    return localStorage.getItem(ACTIVE_VIEW_KEY);
  } catch {
    return null;
  }
}

/** The sidebar view picked in the icon row, remembered across launches. Shared: a view with its own main area replaces the panes. */
export const useActiveViewStore = create<{ stored: string | null; select: (id: string) => void }>((set) => ({
  stored: readStoredView(),
  select: (id) => {
    set({ stored: id });
    try {
      localStorage.setItem(ACTIVE_VIEW_KEY, id);
    } catch {
      // Not remembering the view is fine; it still switches.
    }
  },
}));
