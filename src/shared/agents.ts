import type { PermissionMode } from './claudeChat';

/** Agents: named Claude helpers with a job, a folder and a face (after Bupsy, bupsy.si). Words in GLOSSARY.md. */

export const TRUST_LEVELS = ['ask', 'edits', 'auto', 'never'] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];
export const TRUST_LABELS: Record<TrustLevel, { title: string; detail: string }> = {
  ask: { title: 'Ask me everything', detail: 'Every edit and command waits for you.' },
  edits: { title: 'Allow edits', detail: 'Edits files on its own, asks before commands.' },
  auto: { title: 'Auto', detail: 'Claude approves safe steps and refuses risky ones.' },
  never: { title: 'Never ask', detail: 'Runs everything without asking. Only for agents you fully trust.' },
};

/** Bupsy's face gallery, in its order. */
export const FACE_SHAPES = ['circle', 'drop', 'pick', 'triangle', 'squircle', 'pill', 'pebble', 'ghost', 'cat', 'cloud', 'flower', 'clover', 'star', 'hexagon'] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];
/** Bupsy's eight bot colours (Pink, Violet, Blue, Teal, Green, Lime, Amber, Coral): one lightness round the hue wheel, so no agent outshouts another. */
export const FACE_COLOURS = ['#d46ebd', '#9f82f0', '#4c99f8', '#00afd5', '#00b67f', '#82a821', '#d58300', '#ea6a64'] as const;
export const FACE_COLOUR_NAMES = ['Pink', 'Violet', 'Blue', 'Teal', 'Green', 'Lime', 'Amber', 'Coral'] as const;

export interface AgentFace {
  shape: FaceShape;
  /** Index into FACE_COLOURS. */
  colour: number;
}

export interface Agent {
  id: string;
  name: string;
  /** Short label beside the name ("Ads"). Not instructions; that is the job. */
  role: string;
  job: string;
  /** Where the agent works (absolute path). */
  folder: string;
  /** Claude model alias; "default" leaves it to Claude Code. */
  model: string;
  trust: TrustLevel;
  face: AgentFace;
  pinned: boolean;
  /** Section in the agents column; '' = no section. */
  group: string;
  /** The agent's one ongoing chat; a fresh chat gets a new id. Resumed when Claude has saved it in the folder, else created. */
  sessionId: string;
  handoffNote: string | null;
  createdAt: number;
  /** When Dan last looked at its chat; a reply after this is unread. */
  lastReadAt: number | null;
}

export const MAX_AGENTS = 50;
const MAX_NAME = 40;
const MAX_ROLE = 20;
const MAX_JOB = 4000;
const MAX_NOTE = 4000;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODEL = /^[a-zA-Z0-9.\-[\]_]{1,64}$/;

export function faceFromName(name: string): AgentFace {
  let hash = 5381;
  for (let index = 0; index < name.length; index++) hash = ((hash << 5) + hash + name.charCodeAt(index)) >>> 0;
  return { shape: FACE_SHAPES[hash % FACE_SHAPES.length] ?? 'circle', colour: (hash >>> 5) % FACE_COLOURS.length };
}

export function trustFlags(level: TrustLevel): { mode: PermissionMode; skipPermissions: boolean } {
  if (level === 'never') return { mode: 'default', skipPermissions: true };
  return { mode: level === 'ask' ? 'default' : level === 'edits' ? 'acceptEdits' : 'auto', skipPermissions: false };
}

export interface NewAgentInput {
  name: string;
  job: string;
  folder: string;
  role?: string;
  face?: AgentFace;
}

export function newAgent(input: NewAgentInput, id: string, sessionId: string, now: number): Agent {
  const name = input.name.trim().slice(0, MAX_NAME) || 'Agent';
  return {
    id,
    name,
    role: (input.role ?? '').trim().slice(0, MAX_ROLE),
    job: input.job.trim().slice(0, MAX_JOB),
    folder: input.folder,
    model: 'default',
    trust: 'auto',
    face: input.face ?? faceFromName(name),
    pinned: false,
    group: '',
    sessionId,
    handoffNote: null,
    createdAt: now,
    lastReadAt: null,
  };
}

/** What Details can change; checked again in main. */
export type AgentChange = Partial<Pick<Agent, 'name' | 'role' | 'job' | 'folder' | 'model' | 'trust' | 'face' | 'pinned' | 'group'>>;

/** The changed agent, or null if the change makes it invalid. Changes outside AgentChange are ignored. */
export function applyAgentChange(agent: Agent, change: unknown): Agent | null {
  if (typeof change !== 'object' || change === null) return null;
  const allowed: Array<keyof AgentChange> = ['name', 'role', 'job', 'folder', 'model', 'trust', 'face', 'pinned', 'group'];
  const picked = Object.fromEntries(Object.entries(change).filter(([key]) => (allowed as string[]).includes(key)));
  return normalizeAgents([{ ...agent, ...picked }])[0] ?? null;
}

const text = (value: unknown, max: number): string | null => (typeof value === 'string' ? value.slice(0, max) : null);

function normalizeFace(value: unknown, name: string): AgentFace {
  const face = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const shape = FACE_SHAPES.find((item) => item === face['shape']);
  const colour = face['colour'];
  if (!shape || typeof colour !== 'number' || !Number.isInteger(colour) || colour < 0 || colour >= FACE_COLOURS.length) return faceFromName(name);
  return { shape, colour };
}

function normalizeAgent(value: unknown): Agent | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw['id'], 64);
  const name = text(raw['name'], MAX_NAME)?.trim();
  const folder = text(raw['folder'], 4096);
  const sessionId = raw['sessionId'];
  if (!id || !name || !folder?.startsWith('/') || typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
  const trust = TRUST_LEVELS.find((level) => level === raw['trust']) ?? 'auto';
  const model = typeof raw['model'] === 'string' && MODEL.test(raw['model']) ? raw['model'] : 'default';
  const createdAt = typeof raw['createdAt'] === 'number' ? raw['createdAt'] : 0;
  return {
    id,
    name,
    role: text(raw['role'], MAX_ROLE) ?? '',
    job: text(raw['job'], MAX_JOB) ?? '',
    folder,
    model,
    trust,
    face: normalizeFace(raw['face'], name),
    pinned: raw['pinned'] === true,
    group: text(raw['group'], MAX_NAME) ?? '',
    sessionId,
    handoffNote: text(raw['handoffNote'], MAX_NOTE),
    createdAt,
    lastReadAt: typeof raw['lastReadAt'] === 'number' ? raw['lastReadAt'] : null,
  };
}

export function normalizeAgents(raw: unknown): Agent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAgent).filter((agent): agent is Agent => agent !== null).slice(0, MAX_AGENTS);
}

/** Added to Claude Code's own system prompt: short on purpose, it is sent with every message. */
export function agentSystemPrompt(agent: Agent): string {
  const parts = [`You are ${agent.name}, one of Dan's agents in VISION.`];
  if (agent.job.trim()) parts.push(`Your job:\n${agent.job.trim()}`);
  if (agent.handoffNote?.trim()) parts.push(`Handoff note from your previous chat:\n${agent.handoffNote.trim()}`);
  return parts.join('\n\n');
}

/** The prompt that asks an agent for its handoff note before a fresh chat. */
export const HANDOFF_PROMPT =
  'We are starting a fresh chat to keep things fast. Write a handoff note for your next chat: what you are working on, decisions made, open loops and next steps. At most 12 short lines, no preamble. Reply with the note only.';

export type AgentMood = 'idle' | 'working' | 'waiting' | 'done' | 'sleeping' | 'failed';

/** What the agents column and Waiting on you need to know about each agent, kept up to date by main. */
export interface AgentStatus {
  /** 'off' = no Claude process running (nothing costs anything). */
  phase: 'off' | 'starting' | 'idle' | 'working' | 'stopped';
  needsYou: number;
  failed: boolean;
  /** The last thing said in the chat, for the column. */
  preview: string | null;
  /** When the agent last finished a reply. */
  repliedAt: number | null;
}

export function agentMood(status: { phase: AgentStatus['phase']; needsYou: number; failed: boolean; unread: boolean }): AgentMood {
  if (status.needsYou > 0) return 'waiting';
  if (status.phase === 'working' || status.phase === 'starting') return 'working';
  if (status.failed) return 'failed';
  if (status.unread) return 'done';
  return 'idle';
}

export function waitingCount(statuses: Record<string, { needsYou: number }>): number {
  return Object.values(statuses).reduce((sum, status) => sum + status.needsYou, 0);
}
