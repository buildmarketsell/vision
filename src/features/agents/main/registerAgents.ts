import { BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { IPC } from '../../../shared/ipc';
import { applyAgentChange, FACE_COLOURS, FACE_SHAPES, MAX_AGENTS, newAgent, type AgentFace } from '../../../shared/agents';
import { applyRoutineInput, dueRoutines, type Routine } from '../../../shared/routines';
import { agentChat, agentSettingsChanged, agentStatuses, forgetAgent, freshChat, sendToAgent } from './agentRuns';
import { agentList, changeAgent, findAgent, routineList } from './agentStore';

const ROUTINE_CHECK_MS = 30_000;
const FIRST_ROUTINE_CHECK_MS = 5_000;

async function isFolder(path: string): Promise<boolean> {
  if (!path.startsWith('/')) return false;
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function faceOf(value: unknown): AgentFace | undefined {
  const face = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const shape = FACE_SHAPES.find((item) => item === face['shape']);
  const colour = face['colour'];
  return shape && typeof colour === 'number' && colour >= 0 && colour < FACE_COLOURS.length ? { shape, colour } : undefined;
}

async function createAgent(input: unknown) {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const agents = agentList.load();
  const folder = raw['folder'];
  if (agents.length >= MAX_AGENTS || typeof raw['name'] !== 'string' || typeof folder !== 'string' || !(await isFolder(folder))) return null;
  const face = faceOf(raw['face']);
  const agent = newAgent(
    { name: raw['name'], job: typeof raw['job'] === 'string' ? raw['job'] : '', folder, ...(typeof raw['role'] === 'string' ? { role: raw['role'] } : {}), ...(face ? { face } : {}) },
    randomUUID(),
    randomUUID(),
    Date.now(),
  );
  agentList.commit([...agents, agent]);
  return agent;
}

async function updateAgent(id: unknown, change: unknown) {
  const before = findAgent(id);
  if (!before) return agentList.load();
  const after = applyAgentChange(before, change);
  if (!after || (after.folder !== before.folder && !(await isFolder(after.folder)))) return agentList.load();
  const agents = agentList.commit(agentList.load().map((agent) => (agent.id === after.id ? after : agent)));
  await agentSettingsChanged(before, after);
  return agents;
}

function removeAgent(id: unknown) {
  if (typeof id !== 'string') return agentList.load();
  forgetAgent(id);
  routineList.commit(routineList.load().filter((routine) => routine.agentId !== id));
  return agentList.commit(agentList.load().filter((agent) => agent.id !== id));
}

/** Gives the routine's message to its agent and moves its last run to now. */
function runRoutine(routine: Routine, now: number): void {
  routineList.commit(routineList.load().map((item) => (item.id === routine.id ? { ...item, lastRunAt: now } : item)));
  void sendToAgent(routine.agentId, { kind: 'message', text: `Routine: ${routine.prompt}` }, true);
}

function checkRoutines(): void {
  const now = Date.now();
  const agents = new Set(agentList.load().map((agent) => agent.id));
  for (const routine of dueRoutines(routineList.load(), now)) if (agents.has(routine.agentId)) runRoutine(routine, now);
}

export function registerAgents(): void {
  ipcMain.handle(IPC.agentsList, () => agentList.load());
  ipcMain.handle(IPC.agentsCreate, (_event, input: unknown) => createAgent(input));
  ipcMain.handle(IPC.agentsUpdate, (_event, id: unknown, change: unknown) => updateAgent(id, change));
  ipcMain.handle(IPC.agentsRemove, (_event, id: unknown) => removeAgent(id));
  ipcMain.handle(IPC.agentsPickFolder, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ['openDirectory' as const, 'createDirectory' as const], buttonLabel: 'Choose' };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(IPC.agentsStatuses, () => agentStatuses());
  ipcMain.handle(IPC.agentsChat, (_event, id: unknown) => agentChat(id));
  ipcMain.on(IPC.agentsSend, (_event, id: unknown, message: unknown) => void sendToAgent(id, message));
  ipcMain.on(IPC.agentsFreshChat, (_event, id: unknown) => void freshChat(id));
  ipcMain.on(IPC.agentsMarkRead, (_event, id: unknown) => {
    if (typeof id === 'string') changeAgent(id, (agent) => ({ ...agent, lastReadAt: Date.now() }));
  });

  ipcMain.handle(IPC.routinesList, () => routineList.load());
  ipcMain.handle(IPC.routinesSave, (_event, input: unknown) => {
    const agentId = typeof input === 'object' && input !== null ? (input as Record<string, unknown>)['agentId'] : undefined;
    if (agentId !== undefined && !findAgent(agentId)) return routineList.load();
    const routines = routineList.load();
    const next = applyRoutineInput(routines, input, randomUUID(), Date.now());
    return next === routines ? routines : routineList.commit(next);
  });
  ipcMain.handle(IPC.routinesRemove, (_event, id: unknown) => routineList.commit(routineList.load().filter((routine) => routine.id !== id)));
  ipcMain.handle(IPC.routinesRunNow, (_event, id: unknown) => {
    const routine = routineList.load().find((item) => item.id === id);
    if (routine && findAgent(routine.agentId)) runRoutine(routine, Date.now());
    return routineList.load();
  });

  setTimeout(checkRoutines, FIRST_ROUTINE_CHECK_MS).unref();
  setInterval(checkRoutines, ROUTINE_CHECK_MS).unref();
}
