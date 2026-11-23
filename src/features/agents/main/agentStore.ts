import { IPC } from '../../../shared/ipc';
import { normalizeAgents, type Agent } from '../../../shared/agents';
import { normalizeRoutines, type Routine } from '../../../shared/routines';
import { createJsonListStore } from '../../../main/jsonListStore';

/** Dan's agents and their routines, app-wide in userData (agents.json, routines.json). */
export const agentList = createJsonListStore<Agent>('agents.json', normalizeAgents, IPC.agentsChanged);
export const routineList = createJsonListStore<Routine>('routines.json', normalizeRoutines, IPC.routinesChanged);

export function findAgent(id: unknown): Agent | undefined {
  return typeof id === 'string' ? agentList.load().find((agent) => agent.id === id) : undefined;
}

export function changeAgent(id: string, change: (agent: Agent) => Agent): void {
  const agents = agentList.load();
  if (agents.some((agent) => agent.id === id)) agentList.commit(agents.map((agent) => (agent.id === id ? change(agent) : agent)));
}
