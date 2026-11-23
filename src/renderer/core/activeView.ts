import { create } from 'zustand';
import { allSidebarViews } from './featureIndex';

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

/** Brings the panes back when a full-page view (To-do, Calendar…) covers them, so a tab being opened is seen. */
export function showPanes(): void {
  const views = allSidebarViews();
  const { stored, select } = useActiveViewStore.getState();
  if (!views.find((view) => view.id === stored)?.main) return;
  const panesView = views.find((view) => !view.main);
  if (panesView) select(panesView.id);
}
