import { createElement, useEffect, useState } from 'react';
import { CornerDownRight } from 'lucide-react';
import { create } from 'zustand';
import { rankItems, shortcutLabel } from '../../../shared/palette';
import { useActiveViewStore } from '../activeView';
import { allCommands } from '../commands';
import type { SearchItem } from '../feature';
import { allSearchProviders, allSidebarViews } from '../featureIndex';

export const PALETTE_COMMAND = 'palette.open';
const DEBOUNCE_MS = 120;
const PER_SECTION = 6;

export const usePalette = create<{ open: boolean; toggle: () => void; close: () => void }>((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
}));

export interface Section {
  title: string;
  items: Array<SearchItem & { shortcut?: string }>;
}

function places(): SearchItem[] {
  return allSidebarViews().map((view) => ({
    id: `place:${view.id}`,
    title: view.title,
    kind: 'Place',
    icon: view.icon,
    run: () => useActiveViewStore.getState().select(view.id),
  }));
}

function commands(): Section['items'] {
  return allCommands()
    .filter((command) => command.id !== PALETTE_COMMAND)
    .map((command) => ({
      id: `command:${command.id}`,
      title: command.title,
      kind: 'Command',
      icon: createElement(CornerDownRight, { size: 15, strokeWidth: 1.5 }),
      shortcut: command.shortcut ? shortcutLabel(command.shortcut) : undefined,
      run: () => void command.run(),
    }));
}

type Found = { query: string; sections: Section[] };

/** Asks every feature's provider as Dan types; an answer only counts for the text it was asked for. */
function useProviderSections(query: string): Found | null {
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (!query.trim()) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      const asks = allSearchProviders().map(async (provider) => ({
        title: provider.title,
        items: (await provider.search(query).catch(() => [])).slice(0, PER_SECTION),
      }));
      void Promise.all(asks).then((sections) => !cancelled && setFound({ query, sections }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);
  return found;
}

/** Empty box: places and commands. Typing: matching places and commands first, then each feature's results. */
export function usePaletteSections(query: string): { sections: Section[]; searching: boolean } {
  const found = useProviderSections(query);
  if (!query.trim()) return { sections: [{ title: 'Places', items: places() }, { title: 'Commands', items: commands() }], searching: false };
  const local = [
    { title: 'Places', items: rankItems(places(), query, PER_SECTION) },
    { title: 'Commands', items: rankItems(commands(), query, PER_SECTION) },
  ];
  const current = found?.query === query;
  const remote = found ? found.sections : [];
  return { sections: [...local, ...remote].filter((section) => section.items.length > 0), searching: !current };
}
