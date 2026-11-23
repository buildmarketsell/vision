import { useEffect } from 'react';
import { Hand } from 'lucide-react';
import { waitingCount } from '../../../shared/agents';
import { AgentFace } from './AgentFace';
import { moodOf, openAgent, openAgentsPlace, startAgentsSync, useAgents } from './agentsStore';
import './agents.css';

const MOOD_WORDS = { idle: '', working: 'Working', waiting: 'Needs you', done: 'Replied', sleeping: '', failed: 'Stopped' } as const;

/** Dashboard card: what needs you, then every agent with its mood and last words. */
export function AgentsCard() {
  useEffect(startAgentsSync, []);
  const agents = useAgents((store) => store.agents);
  const statuses = useAgents((store) => store.statuses);
  if (!agents) return <div className="caption">Loading…</div>;
  if (agents.length === 0) return <div className="caption">No agents yet. Make one on the Agents page.</div>;
  const waiting = waitingCount(statuses);
  return (
    <div>
      {waiting > 0 && (
        <button
          className="dash-row w-full text-left"
          onClick={() => openAgentsPlace({ kind: 'waiting' })}
        >
          <Hand size={16} strokeWidth={1.75} />
          <span className="flex-1">Waiting on you</span>
          <span className="agents-count">{waiting}</span>
        </button>
      )}
      {agents.map((agent) => {
        const status = statuses[agent.id];
        const mood = moodOf(agent, status);
        return (
          <button key={agent.id} className="dash-row w-full text-left" onClick={() => openAgent(agent.id)}>
            <AgentFace face={agent.face} mood={mood} size={22} label={agent.name} />
            <span className="shrink-0 font-medium">{agent.name}</span>
            <span className="caption min-w-0 flex-1 truncate">{status?.preview ?? agent.role}</span>
            {MOOD_WORDS[mood] && <span className="caption shrink-0">{MOOD_WORDS[mood]}</span>}
          </button>
        );
      })}
    </div>
  );
}
