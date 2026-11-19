import { createElement } from 'react';
import { Table2 } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { DatabasePanel } from './renderer/DatabasePanel';
import { NotionMain } from './renderer/NotionMain';
import { NotionSidebar } from './renderer/NotionSidebar';
import { DATABASE_TAB } from './renderer/dbStore';

const icon = () => createElement(Table2, { size: 15, strokeWidth: 1.5 });

/** Notion inside VISION: its icon turns the whole window into pages and databases (Dan, 2026-11-19). */
export const notionFeature: Feature = {
  id: 'notion',
  name: 'Notion',
  sidebarViews: [{ id: 'notion', title: 'Database', icon: icon(), component: NotionSidebar, main: NotionMain, ownBottomBar: true, ownTopBar: true }],
  // Kept so database tabs opened before the Notion view still restore.
  tabTypes: [{ id: DATABASE_TAB, component: DatabasePanel, closable: true, icon }],
};
