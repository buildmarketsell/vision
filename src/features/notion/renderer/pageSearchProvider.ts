import { createElement } from 'react';
import { FileText } from 'lucide-react';
import type { SearchProvider } from '../../../renderer/core/feature';
import { useActiveViewStore } from '../../../renderer/core/activeView';
import { rankItems } from '../../../shared/palette';
import { pages, useNav } from './pageStore';

/** VISION's own pages, by title. Picking one opens the Database view on that page. */
export const pageSearchProvider: SearchProvider = {
  id: 'pages',
  title: 'Pages',
  search: async (query) => {
    const all = pages.useStore.getState().items ?? (await window.vision.pages.list());
    const named = all.map((page) => ({ page, title: page.title || 'Untitled' }));
    return rankItems(named, query).map(({ page, title }) => ({
      id: `page:${page.id}`,
      title,
      kind: 'Page',
      icon: page.icon ? createElement('span', { 'aria-hidden': true }, page.icon) : createElement(FileText, { size: 15, strokeWidth: 1.5 }),
      run: () => {
        useActiveViewStore.getState().select('notion');
        useNav.getState().open({ kind: 'page', id: page.id });
      },
    }));
  },
};
