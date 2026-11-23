import { BrowserWindow, Notification } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IPC } from '../../../shared/ipc';
import { DEFAULT_EFFORT } from '../../../shared/claudeChat';
import { agentSystemPrompt, HANDOFF_PROMPT, trustFlags, type Agent, type AgentStatus } from '../../../shared/agents';
import { reduceChat, reduceClaudeEvent, type ChatAction } from '../../../shared/chat/chatReducer';
import { emptyChatState, type ChatState } from '../../../shared/chat/chatTypes';
import { asObj } from '../../../shared/chat/eventParsing';
import { startClaude, toClaudeMessage, type ClaudeRun } from '../../../main/claude/claudeProcess';
import { allWindowContexts } from '../../../main/windows';
import { readConversation, transcriptDirFor } from '../../../main/claude/transcripts';
import { agentList, changeAgent, findAgent } from './agentStore';

/**
 * Runs Dan's agents: one `claude -p` process per agent, started by its first message and stopped after
 * IDLE_STOP_MS without work, so an idle agent costs nothing. Main keeps each agent's chat state (the same
 * pure reducer the windows run) and sends every change to every window, so chats keep going on any page.
 */

const IDLE_STOP_MS = Number(process.env['VISION_AGENT_IDLE_MS'] ?? 10 * 60_000);
const HEADLESS = process.env['VISION_HEADLESS'] === '1';
const PREVIEW_CHARS = 120;
const ACCEPTED = new Set(['message', 'allow', 'deny', 'interrupt']);

interface Runtime {
  state: ChatState;
  run: ClaudeRun | null;
  starting: Promise<ClaudeRun | null> | null;
  /** The process being stopped on purpose (idle, fresh chat, settings changed): its exit is not an error. */
  stopping: ClaudeRun | null;
  /** Stopped while its process was still starting: stop that process as soon as it exists. */
  cancelStart: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  failed: boolean;
  repliedAt: number | null;
  /** Waiting for the handoff note before a fresh chat. */
  handoff: boolean;
  /** Settings changed while it worked: restart with them once it is idle. */
  restartWhenIdle: boolean;
  /** The running turn came from a routine: tell Dan when it is done. */
  fromRoutine: boolean;
  needsYou: number;
}

const runtimes = new Map<string, Runtime>();
let version = 0;
let lastStatuses = '';

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) if (!window.webContents.isDestroyed()) window.webContents.send(channel, payload);
}

function sessionSaved(agent: Agent): boolean {
  return existsSync(join(transcriptDirFor(agent.folder), `${agent.sessionId}.jsonl`));
}

async function loadState(agent: Agent): Promise<ChatState> {
  let state = emptyChatState();
  if (sessionSaved(agent)) for (const event of await readConversation(agent.folder, agent.sessionId)) state = reduceClaudeEvent(state, event);
  return { ...state, phase: 'idle', sessionId: agent.sessionId };
}

async function runtimeFor(agent: Agent): Promise<Runtime> {
  const existing = runtimes.get(agent.id);
  if (existing) return existing;
  const state = await loadState(agent);
  const runtime = runtimes.get(agent.id) ?? {
    state, run: null, starting: null, stopping: null, cancelStart: false, idleTimer: null, failed: false, repliedAt: null, handoff: false, restartWhenIdle: false, fromRoutine: false, needsYou: 0,
  };
  runtimes.set(agent.id, runtime);
  return runtime;
}

function preview(state: ChatState): string | null {
  for (let index = state.items.length - 1; index >= 0; index--) {
    const item = state.items[index];
    if ((item?.kind === 'text' && !item.streaming) || item?.kind === 'user') return item.text.replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS);
  }
  return null;
}

function statusOf(runtime: Runtime | undefined): AgentStatus {
  if (!runtime) return { phase: 'off', needsYou: 0, failed: false, preview: null, repliedAt: null, handingOff: false };
  const { state } = runtime;
  const phase = runtime.starting ? 'starting' : !runtime.run ? 'off' : state.phase === 'working' ? 'working' : state.phase === 'stopped' ? 'stopped' : 'idle';
  return { phase, needsYou: state.permissions.length + state.questions.length, failed: runtime.failed, preview: preview(state), repliedAt: runtime.repliedAt, handingOff: runtime.handoff };
}

export function agentStatuses(): Record<string, AgentStatus> {
  return Object.fromEntries(agentList.load().map((agent) => [agent.id, statusOf(runtimes.get(agent.id))]));
}

function publishStatuses(): void {
  const statuses = agentStatuses();
  const json = JSON.stringify(statuses);
  if (json === lastStatuses) return;
  lastStatuses = json;
  broadcast(IPC.agentsStatusChanged, statuses);
}

function notify(agentId: string, title: string, body: string): void {
  if (HEADLESS || !Notification.isSupported() || BrowserWindow.getFocusedWindow()) return;
  const notification = new Notification({ title, body, sound: 'Glass' });
  notification.on('click', () => {
    // App windows only: the focus island is a BrowserWindow too, always visible and never focused.
    const contexts = allWindowContexts().filter((context) => !context.webContents.isDestroyed());
    const context = contexts.find((item) => item.window.isVisible()) ?? contexts[0];
    if (!context) return;
    context.window.show();
    context.window.focus();
    context.webContents.send(IPC.agentsOpen, agentId);
  });
  notification.show();
}

function apply(agentId: string, runtime: Runtime, action: ChatAction): void {
  runtime.state = reduceChat(runtime.state, action);
  version += 1;
  broadcast(IPC.agentsChatUpdate, { agentId, version, action });
  const needsYou = runtime.state.permissions.length + runtime.state.questions.length;
  if (needsYou > runtime.needsYou) {
    const agent = findAgent(agentId);
    if (agent) notify(agentId, `${agent.name} needs you`, runtime.state.permissions.at(-1)?.description ?? 'Waiting for your answer.');
  }
  runtime.needsYou = needsYou;
  scheduleIdleStop(runtime);
  publishStatuses();
}

function stopRun(runtime: Runtime): void {
  if (runtime.idleTimer) clearTimeout(runtime.idleTimer);
  runtime.idleTimer = null;
  if (runtime.starting) runtime.cancelStart = true;
  if (!runtime.run) return;
  runtime.stopping = runtime.run;
  runtime.run.stop();
  runtime.run = null;
}

function isIdle(runtime: Runtime): boolean {
  return runtime.state.phase !== 'working' && runtime.needsYou === 0 && !runtime.starting;
}

function scheduleIdleStop(runtime: Runtime): void {
  if (runtime.idleTimer) clearTimeout(runtime.idleTimer);
  runtime.idleTimer = null;
  if (!runtime.run || !isIdle(runtime)) return;
  if (runtime.restartWhenIdle) {
    runtime.restartWhenIdle = false;
    stopRun(runtime);
    return;
  }
  runtime.idleTimer = setTimeout(() => {
    stopRun(runtime);
    publishStatuses();
  }, IDLE_STOP_MS);
  runtime.idleTimer.unref?.();
}

function finishHandoff(agent: Agent, runtime: Runtime): void {
  runtime.handoff = false;
  const note = [...runtime.state.items].reverse().find((item) => item.kind === 'text');
  const sessionId = randomUUID();
  changeAgent(agent.id, (current) => ({ ...current, sessionId, handoffNote: note?.kind === 'text' ? note.text.slice(0, 4000) : current.handoffNote }));
  stopRun(runtime);
  const fresh: ChatState = {
    ...emptyChatState(),
    phase: 'idle',
    sessionId,
    items: [{ kind: 'notice', key: 'item-0', text: `Fresh chat. ${agent.name} kept a handoff note, so nothing important is lost.`, tone: 'info' }],
  };
  apply(agent.id, runtime, { type: 'replace', state: fresh });
}

function onEvent(agentId: string, runtime: Runtime, event: unknown): void {
  apply(agentId, runtime, { type: 'claude', event });
  const record = asObj(event);
  if (record?.['type'] !== 'result') return;
  runtime.repliedAt = Date.now();
  runtime.failed = record['is_error'] === true;
  const agent = findAgent(agentId);
  if (!agent) return;
  // A failed handoff turn wrote no note: keep the chat rather than wipe it with an older reply as the note.
  if (runtime.handoff && runtime.failed) runtime.handoff = false;
  else if (runtime.handoff) finishHandoff(agent, runtime);
  else if (runtime.fromRoutine) notify(agentId, `${agent.name} finished a routine`, statusOf(runtime).preview ?? 'Done.');
  runtime.fromRoutine = false;
  publishStatuses();
}

async function ensureRun(agent: Agent, runtime: Runtime): Promise<ClaudeRun | null> {
  if (runtime.run) return runtime.run;
  if (runtime.starting) return runtime.starting;
  if (!existsSync(agent.folder)) {
    runtime.handoff = false;
    apply(agent.id, runtime, { type: 'local/failed', message: `${agent.name}'s folder is gone (${agent.folder}). Pick another one in Details.` });
    return null;
  }
  const flags = trustFlags(agent.trust);
  const saved = sessionSaved(agent);
  let thisRun: ClaudeRun | null = null;
  // This start reads the agent's current settings, so an older restart or stop request no longer applies.
  runtime.restartWhenIdle = false;
  runtime.cancelStart = false;
  runtime.starting = (async () => {
    const started = await startClaude({
      folder: agent.folder,
      mode: flags.mode,
      skipPermissions: flags.skipPermissions,
      model: agent.model === 'default' ? null : agent.model,
      effort: DEFAULT_EFFORT,
      resumeId: saved ? agent.sessionId : null,
      newSessionId: saved ? null : agent.sessionId,
      appendSystemPrompt: agentSystemPrompt(agent),
      onEvent: (event) => onEvent(agent.id, runtime, event),
      onExit: (exitCode, errorTail) => {
        if (thisRun && runtime.stopping === thisRun) {
          runtime.stopping = null;
          publishStatuses();
          return;
        }
        if (runtime.run === thisRun) runtime.run = null;
        // The handoff reply never came; otherwise the next ordinary reply would be taken as the note and wipe the chat.
        runtime.handoff = false;
        runtime.failed = exitCode !== 0;
        apply(agent.id, runtime, { type: 'local/exited', exitCode, errorTail });
      },
    });
    runtime.starting = null;
    if (!started.ok) {
      runtime.failed = true;
      runtime.handoff = false;
      apply(agent.id, runtime, { type: 'local/failed', message: started.message });
      return null;
    }
    thisRun = started.run;
    // Deleted, moved to another folder or quitting while it started: never leave that process running.
    if (runtime.cancelStart) {
      runtime.cancelStart = false;
      runtime.stopping = started.run;
      started.run.stop();
      publishStatuses();
      return null;
    }
    runtime.run = started.run;
    runtime.failed = false;
    publishStatuses();
    return started.run;
  })();
  publishStatuses();
  return runtime.starting;
}

export async function agentChat(agentId: unknown): Promise<{ state: ChatState; version: number } | null> {
  const agent = findAgent(agentId);
  if (!agent) return null;
  const runtime = await runtimeFor(agent);
  return { state: runtime.state, version };
}

/** A message, an answer to an approval or question, or Stop, from a window or a routine. */
export async function sendToAgent(agentId: unknown, outgoing: unknown, fromRoutine = false): Promise<void> {
  const agent = findAgent(agentId);
  const record = asObj(outgoing);
  const message = toClaudeMessage(outgoing);
  if (!agent || !record || !message || !ACCEPTED.has(String(record['kind']))) return;
  const runtime = await runtimeFor(agent);
  // While the handoff note is written, a new message would be answered in the same turn and wiped with the old chat.
  if (record['kind'] === 'message' && runtime.handoff && record['text'] !== HANDOFF_PROMPT) return;
  if (record['kind'] === 'message') {
    if (fromRoutine) runtime.fromRoutine = true;
    apply(agent.id, runtime, { type: 'local/sent', text: String(record['text']).trim() });
  } else if (record['kind'] === 'allow' || record['kind'] === 'deny') {
    apply(agent.id, runtime, { type: 'local/resolved', requestId: String(record['requestId']), denied: record['kind'] === 'deny' });
  }
  if (record['kind'] === 'interrupt' && !runtime.run) return;
  const run = await ensureRun(agent, runtime);
  run?.write(message);
}

/** Asks the agent for a handoff note, then starts its chat over with only that note. */
export async function freshChat(agentId: unknown): Promise<void> {
  const agent = findAgent(agentId);
  if (!agent) return;
  const runtime = await runtimeFor(agent);
  if (runtime.handoff || runtime.state.phase === 'working') return;
  if (!runtime.state.items.some((item) => item.kind === 'user')) return;
  runtime.handoff = true;
  publishStatuses();
  await sendToAgent(agent.id, { kind: 'message', text: HANDOFF_PROMPT });
}

/** Settings that Claude reads at start (folder, job, trust, model) changed: use them from the next message. */
export async function agentSettingsChanged(before: Agent, after: Agent): Promise<void> {
  const runtime = runtimes.get(after.id);
  if (!runtime) return;
  if (before.folder !== after.folder) {
    stopRun(runtime);
    runtimes.delete(after.id);
    const fresh = await runtimeFor(after);
    apply(after.id, fresh, { type: 'replace', state: fresh.state });
    return;
  }
  // The name is in the system prompt too ("You are <name>").
  const restart = before.name !== after.name || before.job !== after.job || before.trust !== after.trust || before.model !== after.model;
  // A process still starting was given the old settings: restart it once it is idle.
  if (!restart || (!runtime.run && !runtime.starting)) return;
  if (isIdle(runtime)) stopRun(runtime);
  else runtime.restartWhenIdle = true;
  publishStatuses();
}

export function forgetAgent(agentId: string): void {
  const runtime = runtimes.get(agentId);
  if (runtime) stopRun(runtime);
  runtimes.delete(agentId);
  publishStatuses();
}

export function stopAllAgents(): void {
  for (const runtime of runtimes.values()) stopRun(runtime);
}
