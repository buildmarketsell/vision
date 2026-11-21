import { app, BrowserWindow, ipcMain } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoSchedule, type PlanTask } from '../../../shared/autoSchedule';
import type { CalendarEvent } from '../../../shared/calendar';
import { IPC } from '../../../shared/ipc';
import { DEFAULT_PLAN_SETTINGS, normalizePlanSettings, PLAN_DAYS, type PlanBlock, type PlanSettings, type PlanState } from '../../../shared/plan';
import { logError } from '../../../main/log';
import { writePrivateJson } from '../../../main/secrets';
import { todoList } from '../../../main/todoList';
import { eventsForPlan, forgetCachedWeeks, onCalendarChanged } from './calendarStore';
import { GoogleError, SignInExpiredError } from './googleAuth';
import { mirrorToGoogle } from './planSync';

const DAY_MS = 24 * 60 * 60_000;
/** Time moves on and Google changes outside VISION, so the plan is redone this often even when nothing in VISION changed. */
const REPLAN_MS = 10 * 60_000;
/** Typing a to-do sends a change per edit; plan once it settles. */
const SETTLE_MS = 1_500;

/** What's saved in userData/plan.json: the settings, the last plan (so a block in progress stays put after a restart), and which Google calendar holds VISION's blocks. */
interface Saved {
  settings: PlanSettings;
  blocks: PlanBlock[];
  mirroredTo: string | null;
}

let saved: Saved | null = null;
let state: PlanState | null = null;
let running: Promise<void> | null = null;
let again = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

const filePath = () => join(app.getPath('userData'), 'plan.json');

function loadSaved(): Saved {
  if (saved) return saved;
  try {
    const raw = JSON.parse(readFileSync(filePath(), 'utf8')) as Record<string, unknown>;
    const blocks = Array.isArray(raw['blocks']) ? (raw['blocks'] as PlanBlock[]).filter((block) => typeof block?.taskId === 'string' && typeof block.start === 'number' && typeof block.end === 'number') : [];
    saved = { settings: normalizePlanSettings(raw['settings']), blocks, mirroredTo: typeof raw['mirroredTo'] === 'string' ? raw['mirroredTo'] : null };
  } catch {
    saved = { settings: DEFAULT_PLAN_SETTINGS, blocks: [], mirroredTo: null };
  }
  return saved;
}

function persist(next: Saved): void {
  saved = next;
  writePrivateJson(filePath(), next).catch((error: unknown) => logError('Could not save plan.json', error));
}

function broadcast(next: PlanState): void {
  state = next;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send(IPC.planChanged, next);
  }
}

function messageFor(error: unknown): string {
  if (error instanceof GoogleError || error instanceof SignInExpiredError) return error.message;
  logError('Planning failed', error instanceof Error ? error.message : 'unknown');
  return 'Planned tasks could not be copied to Google Calendar. VISION tries again in a few minutes.';
}

const takesTime = (event: CalendarEvent) => !event.allDay && !event.free && !event.taskId;

async function planOnce(): Promise<void> {
  const now = Date.now();
  const current = loadSaved();
  const { settings } = current;
  const open = todoList.load().filter((todo) => todo.plan && todo.status !== 'done');
  const openIds = new Set(open.map((todo) => todo.id));
  let error: string | undefined;

  let events: CalendarEvent[] = [];
  try {
    const fetched = await eventsForPlan(now - DAY_MS, now + (PLAN_DAYS + 1) * DAY_MS);
    events = fetched?.events ?? [];
    error = fetched?.error;
  } catch (failure) {
    error = messageFor(failure);
  }

  // A block that has started stays where it is, so it never jumps while Dan works on it.
  const started = settings.enabled ? current.blocks.filter((block) => block.start <= now && block.end > now && openIds.has(block.taskId)) : [];
  const startedMinutes = (id: string) => started.filter((block) => block.taskId === id).reduce((sum, block) => sum + (block.end - block.start) / 60_000, 0);
  const tasks: PlanTask[] = open.flatMap((todo) => {
    if (!todo.plan) return [];
    const minutes = todo.plan.minutes - startedMinutes(todo.id);
    return minutes > 0 ? [{ ...todo.plan, minutes, id: todo.id, title: todo.text, createdAt: todo.createdAt }] : [];
  });
  const busy = [...events.filter(takesTime), ...started].map(({ start, end }) => ({ start, end }));
  const result = settings.enabled && tasks.length > 0 ? autoSchedule({ tasks, busy, settings, now, days: PLAN_DAYS }) : { blocks: [], risks: [] };
  const byId = new Map(open.map((todo) => [todo.id, todo]));
  const planned: PlanBlock[] = result.blocks.map((block) => ({ ...block, title: byId.get(block.taskId)?.text ?? '', hours: byId.get(block.taskId)?.plan?.hours ?? 'personal' }));
  const blocks = [...started.map((block) => ({ ...block, title: byId.get(block.taskId)?.text ?? block.title })), ...planned].sort((a, b) => a.start - b.start);

  // Blocks go to the calendar Dan picked; switching calendars or turning planning off clears the old one.
  let mirroredTo = current.mirroredTo;
  try {
    let writes = 0;
    const target = settings.enabled ? settings.calendarKey : null;
    if (mirroredTo && mirroredTo !== target) {
      writes += await mirrorToGoogle(mirroredTo, [], now);
      mirroredTo = null;
    }
    if (target) {
      writes += await mirrorToGoogle(target, blocks, now);
      mirroredTo = target;
    }
    if (writes > 0) forgetCachedWeeks();
  } catch (failure) {
    error = messageFor(failure);
  }

  persist({ settings, blocks, mirroredTo });
  broadcast({ settings, blocks, risks: result.risks, plannedAt: now, ...(error ? { error } : {}) });
}

/** Plans now; a request while a plan is running makes it plan once more after, with the latest to-dos. */
function replan(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await planOnce().catch((error: unknown) => logError('Planning failed', error));
    } while (again);
    running = null;
  })();
  return running;
}

function replanSoon(): void {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => void replan(), SETTLE_MS);
}

const currentState = (): PlanState => state ?? { settings: loadSaved().settings, blocks: loadSaved().blocks, risks: [], plannedAt: null };

export function registerPlan(): void {
  ipcMain.handle(IPC.planState, () => {
    if (!state) void replan();
    return currentState();
  });
  ipcMain.handle(IPC.planSetSettings, async (_event, raw: unknown) => {
    persist({ ...loadSaved(), settings: normalizePlanSettings(raw) });
    await replan();
    return currentState();
  });
  ipcMain.handle(IPC.planRun, async () => {
    await replan();
    return currentState();
  });
  todoList.onCommit(replanSoon);
  onCalendarChanged(replanSoon);
  setInterval(() => void replan(), REPLAN_MS);
}
