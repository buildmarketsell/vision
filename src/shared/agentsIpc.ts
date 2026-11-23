/** The window's side of Agents (window.vision.agents and .routines). */
import type { Agent, AgentChange, AgentStatus, NewAgentInput } from './agents';
import type { Routine, RoutineInput } from './routines';
import type { ChatAction } from './chat/chatReducer';
import type { ChatState } from './chat/chatTypes';
import type { ChatOutgoing } from './claudeChat';

type Unsubscribe = () => void;

/** One change to an agent's chat; `version` counts every change since VISION started, so a window skips what its snapshot already had. */
export interface AgentChatUpdate {
  agentId: string;
  version: number;
  action: ChatAction;
}

export interface AgentsApi {
  list(): Promise<Agent[]>;
  create(input: NewAgentInput): Promise<Agent | null>;
  /** Each returns every agent after the change. */
  update(id: string, change: AgentChange): Promise<Agent[]>;
  /** Deletes the agent and its routines (its saved chat stays in Claude Code's history). */
  remove(id: string): Promise<Agent[]>;
  /** macOS folder picker; null if cancelled. */
  pickFolder(): Promise<string | null>;
  statuses(): Promise<Record<string, AgentStatus>>;
  /** The agent's chat as it is now, with the version its later updates count from. */
  chat(id: string): Promise<{ state: ChatState; version: number } | null>;
  send(id: string, message: ChatOutgoing): void;
  freshChat(id: string): void;
  markRead(id: string): void;
  onChange(callback: (agents: Agent[]) => void): Unsubscribe;
  onStatus(callback: (statuses: Record<string, AgentStatus>) => void): Unsubscribe;
  onUpdate(callback: (update: AgentChatUpdate) => void): Unsubscribe;
  /** A notification was clicked: show this agent. */
  onOpen(callback: (agentId: string) => void): Unsubscribe;
  }

export interface RoutinesApi {
  list(): Promise<Routine[]>;
  /** Adds (no id) or changes a routine; returns every routine. */
  save(input: RoutineInput): Promise<Routine[]>;
  remove(id: string): Promise<Routine[]>;
  runNow(id: string): Promise<Routine[]>;
  onChange(callback: (routines: Routine[]) => void): Unsubscribe;
  }
