import { createElement } from 'react';
import type { Feature } from '../../renderer/core/feature';
import { ClaudeLogo } from '../../renderer/components/ClaudeLogo';
import { ClaudePanel } from './renderer/ClaudePanel';
import { SessionsView } from './renderer/SessionsView';
import { UsagePanel } from './renderer/usage/UsagePanel';
import { CLAUDE_TAB, DEFAULT_TITLE, focusOrStartClaude, newClaudeSession } from './renderer/sessionsStore';
import { focusClaudeTerminal } from './renderer/useClaudeTerminal';
import { chatSearchProvider } from './renderer/chatSearchProvider';

export const claudeTerminalFeature: Feature = {
  id: 'claude-terminal',
  name: 'Claude',
  // Usage and past chats: a tab in the Workspace panel (Dan, 2026-11-19).
  workspaceTabs: [{ id: 'claude', title: 'Claude', icon: createElement(ClaudeLogo, { size: 16 }), component: SessionsView }],
  tabTypes: [
    {
      id: CLAUDE_TAB,
      component: ClaudePanel,
      closable: true,
      ownGroup: true,
      icon: () => createElement(ClaudeLogo, { size: 15 }),
    },
  ],
  searchProviders: [chatSearchProvider],
  dashboardCards: [{ id: 'usage', title: 'Claude usage', icon: createElement(ClaudeLogo, { size: 14 }), component: UsagePanel }],
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
