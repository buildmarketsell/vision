import { createElement } from 'react';
import { Inbox } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { InboxPage } from './renderer/InboxView';
import { InboxCard } from './renderer/InboxCard';

export const inboxFeature: Feature = {
  id: 'inbox',
  name: 'Inbox',
  sidebarViews: [{ id: 'inbox', title: 'Inbox', icon: createElement(Inbox, { size: 16, strokeWidth: 1.5 }), main: InboxPage }],
  dashboardCards: [{ id: 'inbox', title: 'Inbox', icon: createElement(Inbox, { size: 14, strokeWidth: 1.75 }), component: InboxCard, view: 'inbox' }],
};
