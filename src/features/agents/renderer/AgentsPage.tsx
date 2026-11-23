import { useEffect } from 'react';
import { AgentCreator } from './AgentCreator';
import { AgentDetails } from './AgentDetails';
import { AgentThread } from './AgentThread';
import { AgentsColumn } from './AgentsColumn';
import { startAgentsSync, useAgents } from './agentsStore';
import { RoutinesPage } from './RoutinesPage';
import { WaitingPage } from './WaitingPage';
import './agents.css';

/** The Agents page, after Bupsy: its own column of agents on the left, the picked place on the right. */
export function AgentsPage() {
  useEffect(startAgentsSync, []);
  const agents = useAgents((store) => store.agents);
  const place = useAgents((store) => store.place);
  const detailsOpen = useAgents((store) => store.detailsOpen);
  const creatorOpen = useAgents((store) => store.creatorOpen);
  const setCreatorOpen = useAgents((store) => store.setCreatorOpen);
  const agent = place.kind === 'agent' ? agents?.find((item) => item.id === place.id) : undefined;

  return (
    <div className="agents-page">
      <AgentsColumn />
      <main className="agents-main">
        {place.kind === 'waiting' && <WaitingPage />}
        {place.kind === 'routines' && <RoutinesPage />}
        {agent && <AgentThread key={agent.id} agent={agent} />}
        {agent && detailsOpen && <AgentDetails agent={agent} />}
        {(place.kind === 'none' || (place.kind === 'agent' && !agent)) && agents !== null && (
          <div className="agent-empty">
            <div className="agent-empty-title">{agents.length ? 'Pick an agent' : 'Make your first agent'}</div>
            <div className="agent-muted">An agent is Claude with a job, a folder and a face. It keeps one chat and can run routines.</div>
            <button className="agent-button" data-kind="primary" onClick={() => setCreatorOpen(true)}>New agent</button>
          </div>
        )}
      </main>
      {creatorOpen && <AgentCreator />}
    </div>
  );
}
