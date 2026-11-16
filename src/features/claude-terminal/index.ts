import { createElement } from 'react';
import type { Feature } from '../../renderer/core/feature';
import { focusPanel } from '../../renderer/core/dockActions';
import { ClaudeIcon, ClaudePanel } from './renderer/ClaudePanel';
import { focusClaudeTerminal } from './renderer/useClaudeTerminal';

export const CLAUDE_PANEL_ID = 'claude';

export const claudeTerminalFeature: Feature = {
  id: 'claude-terminal',
  name: 'Claude',
  tabTypes: [
    {
      id: 'claude-terminal',
      component: ClaudePanel,
      closable: false,
      icon: () => createElement(ClaudeIcon, { size: 16 }),
    },
  ],
  defaultPanels: [{ id: CLAUDE_PANEL_ID, tabType: 'claude-terminal', title: 'Claude' }],
  commands: [
    {
      id: 'claude.focus',
      title: 'Ask Claude',
      shortcut: 'Mod+L',
      run: () => {
        focusPanel(CLAUDE_PANEL_ID);
        focusClaudeTerminal();
      },
    },
  ],
};
