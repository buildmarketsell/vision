import type { Agent } from '../../../shared/agents';
import { AgentFace } from './AgentFace';
import { useAgentChat, useAgents } from './agentsStore';
import { AgentQuestionCard, ApprovalCard } from './ThreadParts';

function AgentRequests({ agent }: { agent: Agent }) {
  const state = useAgentChat(agent.id);
  const go = useAgents((store) => store.go);
  if (!state || state.permissions.length + state.questions.length === 0) return null;
  return (
    <section className="waiting-group">
      <button className="waiting-agent" onClick={() => go({ kind: 'agent', id: agent.id })}>
        <AgentFace face={agent.face} mood="waiting" size={22} />
        {agent.name}
        <span className="agent-muted">Open chat</span>
      </button>
      {state.permissions.map((request) => <ApprovalCard key={request.requestId} agent={agent} request={request} />)}
      {state.questions.map((request) => <AgentQuestionCard key={request.requestId} agent={agent} request={request} />)}
    </section>
  );
}

/** Every approval and question from every agent, answerable right here. */
export function WaitingPage() {
  const agents = useAgents((store) => store.agents) ?? [];
  const statuses = useAgents((store) => store.statuses);
  const waiting = agents.filter((agent) => (statuses[agent.id]?.needsYou ?? 0) > 0);
  return (
    <div className="agent-page">
      <div className="agent-column">
        <h1 className="agent-page-title">Waiting on you</h1>
        {waiting.length === 0 ? (
          <div className="agent-empty">
            <AgentFace face={{ shape: 'circle', colour: 4 }} mood="sleeping" size={64} />
            <div className="agent-muted">Nothing needs you. Agents ask here when they need an OK or an answer.</div>
          </div>
        ) : (
          waiting.map((agent) => <AgentRequests key={agent.id} agent={agent} />)
        )}
      </div>
    </div>
  );
}
