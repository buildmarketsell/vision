import { create } from 'zustand';
import type { FocusView } from '../../shared/ipc';

interface FocusStore {
  view: FocusView | null;
}

/** The focus timer as every window sees it (the to-do rows, Settings, ⌘K); one subscription for the whole window. */
export const useFocusStore = create<FocusStore>(() => ({ view: null }));

let listening = false;
/** Starts following the focus; safe to call from every component that needs it. */
export function followFocus(): void {
  if (listening) return;
  listening = true;
  // Listen first: a change that arrives while the first answer is on its way is newer, so that answer is then dropped.
  let changed = false;
  window.vision.focus.onChange((view) => {
    changed = true;
    useFocusStore.setState({ view });
  });
  window.vision.focus.view().then((view) => {
    if (!changed) useFocusStore.setState({ view });
  }, () => undefined);
}

/** Starts a focus; `minutes` null = stopwatch. */
export const startFocus = (todoId: string | null, minutes: number | null) => window.vision.focus.start(todoId, minutes);
