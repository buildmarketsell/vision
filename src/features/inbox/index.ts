import { createElement } from 'react';
import { Inbox } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { InboxView } from './renderer/InboxView';

export const inboxFeature: Feature = {
  id: 'inbox',
  name: 'Inbox',
  sidebarViews: [{ id: 'inbox', title: 'Inbox', icon: createElement(Inbox, { size: 16, strokeWidth: 1.5 }), component: InboxView }],
};
