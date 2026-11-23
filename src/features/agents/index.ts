import { createElement } from 'react';
import { Bot } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { AgentsPage } from './renderer/AgentsPage';
import { agentSearchProvider } from './renderer/agentSearchProvider';
import { AGENTS_VIEW, startAgentsSync, useAgents } from './renderer/agentsStore';

// Every window listens from the start, so a notification click opens the agent even if the page was never shown.
if (typeof window !== 'undefined' && window.vision) startAgentsSync();

/** Agents (Dan, 2026-11-23, after Bupsy): named Claude helpers with a job, a folder, a face and routines. */
export const agentsFeature: Feature = {
  id: 'agents',
  name: 'Agents',
  sidebarViews: [{ id: AGENTS_VIEW, title: 'Agents', icon: createElement(Bot, { size: 16, strokeWidth: 1.5 }), main: AgentsPage }],
  searchProviders: [agentSearchProvider],
  commands: [{ id: 'agents.new', title: 'New Agent', run: () => useAgents.getState().setCreatorOpen(true) }],
};
