import { useEffect } from 'react';
import { create } from 'zustand';
import type { Unsubscribe } from '../../../shared/ipc';

interface ListApi<T> {
  list(): Promise<T[]>;
  save(item: T): Promise<T[]>;
  remove(id: string): Promise<T[]>;
  onChange(callback: (items: T[]) => void): Unsubscribe;
}

/**
 * A list saved by the main process (pages, databases), edited on screen at once and saved behind.
 * While saves are on their way, broadcasts are older than the screen and are skipped, so nothing jumps back.
 */
export function createSyncedList<T extends { id: string }>(api: () => ListApi<T>, loadError: string) {
  const useStore = create<{ items: T[] | null; error: string | null }>(() => ({ items: null, error: null }));
  let pending = 0;
  let subscribed = false;

  const persist = (action: Promise<T[]>) => {
    pending += 1;
    action
      .catch(() => useStore.setState({ error: 'That did not save. Try again.' }))
      .finally(() => {
        pending -= 1;
      });
  };
  const setItems = (items: T[]) => useStore.setState({ items, error: null });
  // Delayed saves (typing): the newest version of each item waits here, counted as pending.
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();
  const flush = (id: string) => {
    const timer = waiting.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    waiting.delete(id);
    pending -= 1;
    const item = useStore.getState().items?.find((candidate) => candidate.id === id);
    if (item) persist(api().save(item));
  };
  window.addEventListener('beforeunload', () => [...waiting.keys()].forEach(flush));
  const get = (id: string) => useStore.getState().items?.find((item) => item.id === id);

  return {
    useStore,
    get,
    /** `delayMs` waits for a pause before saving (typing), so every key isn't a write. */
    change(id: string, edit: (item: T) => T, delayMs = 0): void {
      const current = get(id);
      if (!current) return;
      const next = edit(current);
      if (next === current) return;
      setItems((useStore.getState().items ?? []).map((item) => (item.id === id ? next : item)));
      if (waiting.has(id)) clearTimeout(waiting.get(id));
      else pending += 1;
      waiting.set(id, setTimeout(() => flush(id), delayMs));
    },
    flush,
    add(item: T): void {
      setItems([...(useStore.getState().items ?? []), item]);
      persist(api().save(item));
    },
    /** `gone` lists what disappears on screen (a page takes its sub-pages with it). */
    remove(id: string, gone: Set<string> = new Set([id])): void {
      setItems((useStore.getState().items ?? []).filter((item) => !gone.has(item.id)));
      persist(api().remove(id));
    },
    /** Loads once and keeps every window in sync. */
    useLoaded() {
      useEffect(() => {
        if (subscribed) return;
        subscribed = true;
        api().list().then(setItems, () => useStore.setState({ error: loadError }));
        api().onChange((items) => pending === 0 && useStore.setState({ items }));
      }, []);
      return useStore();
    },
  };
}
