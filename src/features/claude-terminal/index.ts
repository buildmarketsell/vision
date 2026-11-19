import { createElement } from 'react';
import type { Feature } from '../../renderer/core/feature';
import { ClaudeLogo } from '../../renderer/components/ClaudeLogo';
import { ClaudePanel } from './renderer/ClaudePanel';
import { SessionsView } from './renderer/SessionsView';
import { CLAUDE_TAB, DEFAULT_TITLE, focusOrStartClaude, newClaudeSession } from './renderer/sessionsStore';
import { focusClaudeTerminal } from './renderer/useClaudeTerminal';

export const claudeTerminalFeature: Feature = {
  id: 'claude-terminal',
  name: 'Claude',
  // Usage and past chats: opened from the button at the bottom of the sidebar, not the menu (Dan, 2026-11-19).
  sidebarViews: [{ id: 'claude-sessions', title: 'Usage', icon: createElement(ClaudeLogo, { size: 15 }), component: SessionsView, inSidebar: true }],
  tabTypes: [
    {
      id: CLAUDE_TAB,
      component: ClaudePanel,
      closable: true,
      ownGroup: true,
      icon: () => createElement(ClaudeLogo, { size: 15 }),
    },
  ],
  defaultPanels: [{ id: 'claude:first', tabType: CLAUDE_TAB, title: DEFAULT_TITLE }],
  commands: [
    {
      id: 'claude.focus',
      title: 'Ask Claude',
      shortcut: 'Mod+L',
      run: () => {
        const id = focusOrStartClaude();
        if (id) focusClaudeTerminal(id);
      },
    },
    { id: 'claude.new', title: 'New Claude Session', shortcut: 'Mod+T', run: () => newClaudeSession() },
  ],
};
