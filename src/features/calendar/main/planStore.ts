import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { autoSchedule } from '../../../shared/autoSchedule';
import type { CalendarEvent } from '../../../shared/calendar';
import { IPC } from '../../../shared/ipc';
import { normalizePlanSettings, PLAN_DAYS, type PlanBlock, type PlanRisk, type PlanState } from '../../../shared/plan';
import { planProgress } from '../../../shared/planProgress';
import { logError } from '../../../main/log';
import { createDocumentStore } from '../../../main/documentStore';
import { todoList } from '../../../main/todoList';
import { eventsForPlan, forgetCachedWeeks, onCalendarChanged } from './calendarStore';
import { GoogleError, SignInExpiredError } from './googleAuth';
import { canReach, mirrorToGoogle } from './planSync';

const DAY_MS = 24 * 60 * 60_000;
/** Time moves on and Google changes outside VISION, so the plan is redone this often even when nothing in VISION changed. */
const REPLAN_MS = 10 * 60_000;
/** Typing a to-do sends a change per edit; plan once it settles. */
const SETTLE_MS = 1_500;

/**
 * What's saved in userData/plan.json: the settings, the coming blocks (so one in progress stays put after a restart),
 * past blocks (time already worked), and which Google calendar holds VISION's blocks.
 */
interface Saved {
  settings: PlanState['settings'];
  blocks: PlanBlock[];
  past: PlanBlock[];
  mirroredTo: string | null;
}

let state: PlanState | null = null;
let running: Promise<void> | null = null;
let again = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

const isBlock = (value: unknown): value is PlanBlock => {
  const block = value as Partial<PlanBlock> | null;
  return typeof block?.taskId === 'string' && typeof block.title === 'string' && typeof block.start === 'number' && typeof block.end === 'number' && (block.hours === 'work' || block.hours === 'personal');
};
const blocksIn = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isBlock) : []);

const document = createDocumentStore<Saved>({
  path: () => join(app.getPath('userData'), 'plan.json'),
  read: (value) => {
    const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    return { settings: normalizePlanSettings(raw['settings']), blocks: blocksIn(raw['blocks']), past: blocksIn(raw['past']), mirroredTo: typeof raw['mirroredTo'] === 'string' ? raw['mirroredTo'] : null };
  },
});

const loadSaved = (): Saved => document.get();

function persist(change: Partial<Saved>): void {
  document.set({ ...loadSaved(), ...change }).catch((error: unknown) => logError('Could not save plan.json', error));
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

/** Makes Google match the plan: the old calendar is emptied when Dan picks another one or turns planning off. */
async function mirror(target: string | null, blocks: PlanBlock[], now: number): Promise<void> {
  let writes = 0;
  const previous = loadSaved().mirroredTo;
  try {
    if (previous && previous !== target) {
      if (canReach(previous)) writes += await mirrorToGoogle(previous, [], now);
      else logError('Planned blocks left on a calendar whose account was removed', previous);
      persist({ mirroredTo: null });
    }
    if (target) {
      // Remembered before writing: if this run fails halfway, the blocks it wrote can still be cleaned up later.
      persist({ mirroredTo: target });
      writes += await mirrorToGoogle(target, blocks, now);
    }
  } finally {
    if (writes > 0) forgetCachedWeeks();
  }
}

async function planOnce(): Promise<void> {
  const now = Date.now();
  const { settings, blocks: previous, past } = loadSaved();
  let fetched: Awaited<ReturnType<typeof eventsForPlan>>;
  try {
    fetched = await eventsForPlan(now - DAY_MS, now + (PLAN_DAYS + 1) * DAY_MS);
  } catch (failure) {
    fetched = { events: [], problem: messageFor(failure) };
  }
  if (fetched?.problem) {
    // Planning without some calendars would put tasks over meetings: keep the last plan until they can be read.
    broadcast({ ...(state ?? { blocks: [...past, ...previous], risks: [], plannedAt: null }), settings, error: `The plan wasn't updated. ${fetched.problem}` });
    return;
  }

  const todos = todoList.load();
  const progress = planProgress(todos, previous, past, now, settings.enabled);
  const busy = [...(fetched?.events ?? []).filter(takesTime), ...progress.started].map(({ start, end }) => ({ start, end }));
  const result = settings.enabled && progress.tasks.length > 0 ? autoSchedule({ tasks: progress.tasks, busy, settings, now, days: PLAN_DAYS }) : { blocks: [], risks: [] };
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const titled = (block: Omit<PlanBlock, 'title' | 'hours'> & Partial<PlanBlock>): PlanBlock => ({
    ...block,
    title: byId.get(block.taskId)?.text ?? block.title ?? '',
    hours: byId.get(block.taskId)?.plan?.hours ?? block.hours ?? 'personal',
  });
  const coming = [...progress.started, ...result.blocks].map(titled).sort((a, b) => a.start - b.start);
  const risks: PlanRisk[] = settings.enabled ? result.risks : [];

  let error: string | undefined;
  try {
    await mirror(settings.enabled ? settings.calendarKey : null, coming, now);
  } catch (failure) {
    error = messageFor(failure);
  }
  persist({ blocks: coming, past: progress.past });
  // Settings are read again: Dan may have saved new ones while this plan was being made (another run follows for them).
  broadcast({ settings: loadSaved().settings, blocks: [...progress.past.map(titled), ...coming], risks, plannedAt: now, ...(error ? { error } : {}) });
}

/** Plans now; a request while a plan is running makes it plan once more after, with the latest to-dos and settings. */
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

const currentState = (): PlanState => state ?? { settings: loadSaved().settings, blocks: [...loadSaved().past, ...loadSaved().blocks], risks: [], plannedAt: null };

export function registerPlan(): void {
  ipcMain.handle(IPC.planState, () => {
    if (!state) void replan();
    return currentState();
  });
  ipcMain.handle(IPC.planSetSettings, async (_event, raw: unknown) => {
    persist({ settings: normalizePlanSettings(raw) });
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
