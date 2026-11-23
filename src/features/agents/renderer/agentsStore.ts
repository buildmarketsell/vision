import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { agentMood, type Agent, type AgentMood, type AgentStatus } from '../../../shared/agents';
import type { Routine } from '../../../shared/routines';
import { reduceChat, type ChatAction } from '../../../shared/chat/chatReducer';
import type { ChatState } from '../../../shared/chat/chatTypes';
import type { ChatOutgoing } from '../../../shared/claudeChat';
import { useActiveViewStore } from '../../../renderer/core/activeView';

export const AGENTS_VIEW = 'agents';

/** What fills the right side of the Agents page. */
export type AgentsPlace = { kind: 'agent'; id: string } | { kind: 'waiting' } | { kind: 'routines' } | { kind: 'none' };

interface AgentsStore {
  agents: Agent[] | null;
  statuses: Record<string, AgentStatus>;
  routines: Routine[];
  place: AgentsPlace;
  detailsOpen: boolean;
  creatorOpen: boolean;
  go: (place: AgentsPlace) => void;
  setDetailsOpen: (open: boolean) => void;
  setCreatorOpen: (open: boolean) => void;
}

export const useAgents = create<AgentsStore>((set) => ({
  agents: null,
  statuses: {},
  routines: [],
  place: { kind: 'none' },
  detailsOpen: false,
  creatorOpen: false,
  go: (place) => set({ place }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setCreatorOpen: (creatorOpen) => set({ creatorOpen }),
}));

let started = false;

/** Loads agents, statuses and routines once per window and keeps them current. */
export function startAgentsSync(): void {
  if (started) return;
  started = true;
  const vision = window.vision;
  void vision.agents.list().then((agents) => {
    useAgents.setState((state) => ({ agents, place: state.place.kind === 'none' && agents[0] ? { kind: 'agent', id: agents[0].id } : state.place }));
  });
  void vision.agents.statuses().then((statuses) => useAgents.setState({ statuses }));
  void vision.routines.list().then((routines) => useAgents.setState({ routines }));
  vision.agents.onChange((agents) => useAgents.setState({ agents }));
  vision.agents.onStatus((statuses) => useAgents.setState({ statuses }));
  vision.routines.onChange((routines) => useAgents.setState({ routines }));
  vision.agents.onOpen((id) => openAgent(id));
}

export function openAgent(id: string): void {
  openAgentsPlace({ kind: 'agent', id });
}

export function openAgentsPlace(place: AgentsPlace): void {
  useActiveViewStore.getState().select(AGENTS_VIEW);
  useAgents.getState().go(place);
}

export function moodOf(agent: Agent, status: AgentStatus | undefined): AgentMood {
  if (!status) return 'idle';
  const unread = status.repliedAt !== null && (agent.lastReadAt === null || status.repliedAt > agent.lastReadAt);
  return agentMood({ ...status, unread });
}

/** One agent's chat, live: the snapshot from main, then every change after it. */
export function useAgentChat(agentId: string | null): ChatState | null {
  const [chat, setChat] = useState<{ agentId: string; state: ChatState } | null>(null);
  useEffect(() => {
    if (!agentId) return undefined;
    let version: number | null = null;
    const early: Array<{ version: number; action: ChatAction }> = [];
    const off = window.vision.agents.onUpdate((update) => {
      if (update.agentId !== agentId) return;
      if (version === null) early.push(update);
      else if (update.version > version) setChat((current) => (current?.agentId === agentId ? { agentId, state: reduceChat(current.state, update.action) } : current));
    });
    void window.vision.agents.chat(agentId).then((snapshot) => {
      if (!snapshot) return;
      version = snapshot.version;
      const start = snapshot.version;
      const state = early.filter((item) => item.version > start).reduce((current, item) => reduceChat(current, item.action), snapshot.state);
      setChat({ agentId, state });
    });
    return off;
  }, [agentId]);
  // A chat loaded for another agent is never shown while the new one loads.
  return chat && chat.agentId === agentId ? chat.state : null;
}

export function sendToAgent(agentId: string, message: ChatOutgoing): void {
  window.vision.agents.send(agentId, message);
}
