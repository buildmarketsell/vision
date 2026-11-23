import { createElement } from 'react';
import { Clapperboard } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { ContentPage } from './renderer/ContentPage';
import { ContentCard } from './renderer/ContentCard';

/** Content (Dan, 2026-11-20): a dashboard of his YouTube and Instagram numbers first; more content tools will live here. */
export const contentFeature: Feature = {
  id: 'content',
  name: 'Content',
  sidebarViews: [{ id: 'content', title: 'Content', icon: createElement(Clapperboard, { size: 16, strokeWidth: 1.5 }), main: ContentPage }],
  dashboardCards: [{ id: 'content', title: 'Content', icon: createElement(Clapperboard, { size: 14, strokeWidth: 1.75 }), component: ContentCard, view: 'content' }],
};
