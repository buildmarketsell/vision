import { useState } from 'react';
import { ChevronRight, Hand, Plus, Repeat } from 'lucide-react';
import { waitingCount, type Agent } from '../../../shared/agents';
import { AgentFace } from './AgentFace';
import { moodOf, useAgents, type AgentsPlace } from './agentsStore';

/** Bupsy's left column: Waiting on you and Routines on top, then Pinned, then agents by section. */

function same(a: AgentsPlace, b: AgentsPlace): boolean {
  return a.kind === b.kind && (a.kind !== 'agent' || (b.kind === 'agent' && a.id === b.id));
}

function AgentRow({ agent }: { agent: Agent }) {
  const status = useAgents((store) => store.statuses[agent.id]);
  const place = useAgents((store) => store.place);
  const go = useAgents((store) => store.go);
  const mood = moodOf(agent, status);
  const selected = same(place, { kind: 'agent', id: agent.id });
  return (
    <button className="agents-row" data-selected={selected} data-unread={mood === 'done'} aria-current={selected ? 'page' : undefined} onClick={() => go({ kind: 'agent', id: agent.id })}>
      <AgentFace face={agent.face} mood={mood} size={22} label={agent.name} />
      <span className="agents-row-name">{agent.name}</span>
      {mood === 'waiting' ? <span className="agents-dot" aria-label="Needs you" /> : agent.role && <span className="agents-chip">{agent.role}</span>}
    </button>
  );
}

function Section({ title, agents }: { title: string; agents: Agent[] }) {
  const [open, setOpen] = useState(true);
  if (agents.length === 0) return null;
  return (
    <div className="agents-section">
      <button className="agents-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronRight size={12} strokeWidth={2} style={{ transform: open ? 'rotate(90deg)' : undefined }} />
        {title}
        {!open && <span className="agents-chip">{agents.length}</span>}
      </button>
      {open && agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)}
    </div>
  );
}

export function AgentsColumn() {
  const agents = useAgents((store) => store.agents) ?? [];
  const statuses = useAgents((store) => store.statuses);
  const place = useAgents((store) => store.place);
  const go = useAgents((store) => store.go);
  const setCreatorOpen = useAgents((store) => store.setCreatorOpen);
  const waiting = waitingCount(statuses);
  const pinned = agents.filter((agent) => agent.pinned);
  const rest = agents.filter((agent) => !agent.pinned);
  const groups = [...new Set(rest.map((agent) => agent.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return (
    <nav className="agents-column" aria-label="Agents">
      <div className="agents-column-head">
        <span className="agents-column-title">Agents</span>
        <button className="agents-icon-button" aria-label="New agent" title="New agent" onClick={() => setCreatorOpen(true)}>
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
      <button className="agents-row" data-selected={place.kind === 'waiting'} onClick={() => go({ kind: 'waiting' })}>
        <Hand size={16} strokeWidth={1.75} />
        <span className="agents-row-name">Waiting on you</span>
        {waiting > 0 && <span className="agents-count">{waiting}</span>}
      </button>
      <button className="agents-row" data-selected={place.kind === 'routines'} onClick={() => go({ kind: 'routines' })}>
        <Repeat size={16} strokeWidth={1.75} />
        <span className="agents-row-name">Routines</span>
      </button>
      <div className="agents-scroll">
        <Section title="Pinned" agents={pinned} />
        <Section title="Agents" agents={rest.filter((agent) => !agent.group)} />
        {groups.map((group) => <Section key={group} title={group} agents={rest.filter((agent) => agent.group === group)} />)}
        {agents.length === 0 && <div className="agents-hint">No agents yet. Make one with +.</div>}
      </div>
    </nav>
  );
}
