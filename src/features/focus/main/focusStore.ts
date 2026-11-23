import { app, BrowserWindow, ipcMain, Notification, powerMonitor, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { CalendarEvent } from '../../../shared/calendar';
import { actOnFocus, MAX_FOCUS_LOG, MAX_FOCUS_TITLE, normalizeFocusSaved, startFocus, tickFocus, toFocusAction, toFocusMinutes, type FocusAction, type FocusChange, type FocusSaved } from '../../../shared/focus';
import { glance } from '../../../shared/glance';
import { IPC, type FocusView } from '../../../shared/ipc';
import { headsUpMeeting, safeJoinLink } from '../../../shared/meetings';
import { planForMore } from '../../../shared/planProgress';
import { applyTodoChange, type TodoChange } from '../../../shared/todos';
import { calendarBridge } from '../../../main/calendarBridge';
import { createDocumentStore } from '../../../main/documentStore';
import { logError } from '../../../main/log';
import { todoList } from '../../../main/todoList';
import { allWindowContexts, createWindow } from '../../../main/windows';
import { createFocusTray } from './focusTray';
import { registerIsland, updateIsland } from './islandWindow';
import type { TrayRun } from './trayMenu';

const HEADLESS = process.env['VISION_HEADLESS'] === '1';
/** Meetings are read again this often (the Calendar caches Google for 3 minutes, so this costs little). */
const MEETINGS_MS = 60_000;
const TICK_MS = 1_000;
/** Tests shorten a minute so a countdown ends in seconds. */
const TEST_MINUTE_MS = Number(process.env['VISION_FOCUS_TEST_MINUTE_MS']) || 0;

const document = createDocumentStore<FocusSaved>({ path: () => join(app.getPath('userData'), 'focus.json'), read: normalizeFocusSaved });

let meetings: CalendarEvent[] = [];
/** Meetings whose heads-up Dan hid, and those already announced (both forgotten on restart, which is fine). */
const dismissed = new Set<string>();
const announced = new Set<string>();
let lastGlance = '';
let tray: ReturnType<typeof createFocusTray> | null = null;
/** Kept so macOS still delivers their clicks (a collected notification loses its handlers). */
const shown = new Set<Notification>();

const saved = (): FocusSaved => document.get();

function save(change: Partial<FocusSaved>): void {
  document.set({ ...saved(), ...change }).catch((error: unknown) => logError('Could not save focus.json', error));
}

function view(now = Date.now()): FocusView {
  const { state, island } = saved();
  return { state, glance: glance(state, headsUpMeeting(meetings, now, dismissed), now), island };
}

/** Menu bar and island follow every change of the glance (each second while a clock runs). */
function refreshGlance(current: FocusView): void {
  const key = JSON.stringify(current.glance) + current.island;
  if (key === lastGlance) return;
  lastGlance = key;
  tray?.update(current.glance);
  updateIsland(current);
}

/** After a change to the focus itself: every window hears about it (not every second). */
function broadcast(): FocusView {
  const current = view();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send(IPC.focusChanged, current);
  }
  refreshGlance(current);
  return current;
}

function apply(change: FocusChange): void {
  const { log } = saved();
  save({ state: change.state, log: change.finished ? [...log, change.finished].slice(-MAX_FOCUS_LOG) : log });
}

function changeTodo(id: string, change: TodoChange): void {
  const todos = todoList.load();
  const next = applyTodoChange(todos, id, change);
  if (next !== todos) todoList.commit(next);
}

function notify(title: string, body: string, actions: Array<{ text: string; run: () => void }> = []): void {
  if (HEADLESS || !Notification.isSupported()) return;
  const notification = new Notification({ title, body, sound: 'Glass', actions: actions.map(({ text }) => ({ type: 'button' as const, text })) });
  notification.on('action', (_event, index) => actions[index]?.run());
  // Without the island, a click opens the menu bar's menu, where the answers are.
  notification.on('click', () => {
    if (!saved().island) tray?.popUp();
  });
  notification.on('close', () => shown.delete(notification));
  shown.add(notification);
  notification.show();
}

function start(todoId: unknown, minutes: unknown): FocusView {
  const length = toFocusMinutes(minutes);
  if (length === false || (todoId !== null && typeof todoId !== 'string')) return view();
  const todo = typeof todoId === 'string' ? todoList.load().find((item) => item.id === todoId) : null;
  if (todoId !== null && !todo) return view();
  const scaled = length !== null && TEST_MINUTE_MS ? (length * TEST_MINUTE_MS) / 60_000 : length;
  apply(startFocus(saved().state, { id: randomUUID(), todoId: todo?.id ?? null, title: (todo?.text ?? 'Focus').slice(0, MAX_FOCUS_TITLE), minutes: scaled }, Date.now()));
  if (todo && todo.status !== 'doing') changeTodo(todo.id, { status: 'doing' });
  return broadcast();
}

function act(action: FocusAction): FocusView {
  const now = Date.now();
  const before = saved().state;
  const change = actOnFocus(before, action, now);
  if (change.state === before) return view(now);
  apply(change);
  const todoId = change.finished?.todoId;
  if (todoId && action.kind === 'done') changeTodo(todoId, { status: 'done' });
  if (todoId && action.kind === 'not-yet') {
    const todo = todoList.load().find((item) => item.id === todoId);
    if (todo) changeTodo(todoId, { plan: planForMore(todo, calendarBridge.planBlocks(), now, action.minutes) });
  }
  return broadcast();
}

function joinMeeting(): void {
  const link = safeJoinLink(headsUpMeeting(meetings, Date.now(), dismissed)?.joinUrl);
  if (link) void shell.openExternal(link);
}

function dismissMeeting(): void {
  const meeting = headsUpMeeting(meetings, Date.now(), dismissed);
  if (meeting) dismissed.add(meeting.id);
  broadcast();
}

function openVision(): void {
  const first = allWindowContexts()[0];
  if (first) first.window.show();
  else createWindow(null);
  app.focus({ steal: true });
}

function runFromTray(what: TrayRun): void {
  if (what.type === 'start') start(null, what.minutes);
  else if (what.type === 'focus') act(what.action);
  else if (what.type === 'join') joinMeeting();
  else if (what.type === 'dismiss') dismissMeeting();
  else openVision();
}

function tick(): void {
  const now = Date.now();
  const ticked = tickFocus(saved().state, now);
  if (ticked.ended) {
    apply(ticked);
    const title = ticked.state.checkIn?.title ?? 'Focus';
    const hasTodo = ticked.state.checkIn?.todoId !== null;
    notify("Time's up", hasTodo ? `${title}: done?` : `${title} is over.`, [
      { text: hasTodo ? 'Done' : 'Finish', run: () => act({ kind: 'done' }) },
      { text: '+5 min', run: () => act({ kind: 'add' }) },
    ]);
    broadcast();
    return;
  }
  const meeting = headsUpMeeting(meetings, now, dismissed);
  if (meeting && !announced.has(meeting.id) && now < meeting.start) {
    announced.add(meeting.id);
    const minutes = Math.max(1, Math.round((meeting.start - now) / 60_000));
    notify(meeting.title, `Starts in ${minutes} min`, meeting.joinUrl ? [{ text: 'Join', run: joinMeeting }] : []);
  }
  refreshGlance(view(now));
}

async function readMeetings(): Promise<void> {
  try {
    meetings = await calendarBridge.events();
  } catch (error) {
    // The calendar shows its own errors; the heads-up just keeps the meetings it had.
    logError('Could not read meetings for the heads-up', error instanceof Error ? error.message : 'unknown');
  }
}

export function registerFocus(): void {
  ipcMain.handle(IPC.focusView, () => view());
  ipcMain.handle(IPC.focusStart, (_event, todoId: unknown, minutes: unknown) => start(todoId, minutes));
  ipcMain.handle(IPC.focusAct, (_event, raw: unknown) => {
    const action = toFocusAction(raw);
    return action ? act(action) : view();
  });
  ipcMain.on(IPC.focusJoin, joinMeeting);
  ipcMain.on(IPC.focusDismissMeeting, dismissMeeting);
  ipcMain.handle(IPC.focusSetIsland, (_event, on: unknown) => {
    if (typeof on === 'boolean') save({ island: on });
    return broadcast();
  });
  registerIsland();

  // A renamed to-do shows its new name in the menu bar and island.
  todoList.onCommit((todos) => {
    const { state } = saved();
    const focus = state.focus ?? state.checkIn;
    const text = todos.find((todo) => todo.id === focus?.todoId)?.text.slice(0, MAX_FOCUS_TITLE);
    if (!focus || text === undefined || text === focus.title) return;
    save({ state: state.focus ? { ...state, focus: { ...focus, title: text } } : { ...state, checkIn: { ...focus, title: text } } });
    broadcast();
  });

  // Time away from the Mac isn't focus time (Black Hole does the same).
  const pause = () => act({ kind: 'pause' });
  powerMonitor.on('suspend', pause);
  powerMonitor.on('lock-screen', pause);

  void app.whenReady().then(() => {
    if (!HEADLESS) tray = createFocusTray(runFromTray);
    broadcast();
    void readMeetings().then(() => refreshGlance(view()));
    setInterval(() => void readMeetings(), MEETINGS_MS);
    setInterval(tick, TICK_MS);
  });
}
