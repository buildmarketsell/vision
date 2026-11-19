import { createElement } from 'react';
import { Table2 } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { DatabasePanel } from './renderer/DatabasePanel';
import { DatabasesView } from './renderer/DatabasesView';
import { DATABASE_TAB } from './renderer/dbStore';

const icon = () => createElement(Table2, { size: 15, strokeWidth: 1.5 });

export const databasesFeature: Feature = {
  id: 'databases',
  name: 'Databases',
  sidebarViews: [{ id: 'databases', title: 'Databases', icon: icon(), component: DatabasesView }],
  tabTypes: [{ id: DATABASE_TAB, component: DatabasePanel, closable: true, icon }],
};
