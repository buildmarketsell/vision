import { createElement } from 'react';
import type { SearchProvider } from '../../../renderer/core/feature';
import { rankItems } from '../../../shared/palette';
import { AgentFace } from './AgentFace';
import { openAgent } from './agentsStore';

/** Agents by name or role; picking one opens its chat. */
export const agentSearchProvider: SearchProvider = {
  id: 'agents',
  title: 'Agents',
  search: async (query) => {
    const agents = await window.vision.agents.list();
    return rankItems(agents.map((agent) => ({ agent, title: agent.name })), query).map(({ agent, title }) => ({
      id: `agent:${agent.id}`,
      title,
      detail: agent.role || undefined,
      kind: 'Agent',
      icon: createElement(AgentFace, { face: agent.face, size: 16 }),
      run: () => openAgent(agent.id),
    }));
  },
};
