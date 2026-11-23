import { createElement } from 'react';
import type { SearchProvider } from '../../../renderer/core/feature';
import { ClaudeLogo } from '../../../renderer/components/ClaudeLogo';
import { showPanes } from '../../../renderer/core/activeView';
import { rankItems } from '../../../shared/palette';
import { openConversation } from './sessionsStore';
import { timeAgo } from '../../../renderer/core/timeAgo';

/** The open folder's saved Claude conversations, by name. Picking one goes to its tab or continues it. */
export const chatSearchProvider: SearchProvider = {
  id: 'chats',
  title: 'Past chats',
  search: async (query) => {
    const past = await window.vision.chat.list();
    const now = Date.now();
    return rankItems(past, query).map((chat) => ({
      id: `chat:${chat.sessionId}`,
      title: chat.title,
      detail: timeAgo(chat.updatedAt, now),
      kind: 'Chat',
      icon: createElement(ClaudeLogo, { size: 15 }),
      run: () => {
        showPanes();
        openConversation(chat);
      },
    }));
  },
};
