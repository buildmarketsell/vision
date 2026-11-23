/**
 * Focus: a timed stretch of work on one to-do (or on nothing), after Black Hole's focus timer (getblackhole.app, MIT).
 * Pure: every change is a function of the state and the time. Focused time is worked out from timestamps, never counted
 * by ticks, so a busy or sleeping Mac never makes the clock drift.
 */

const MINUTE_MS = 60_000;
/** What +5 min adds, to a running countdown or at a check-in. */
export const ADD_MS = 5 * MINUTE_MS;
export const FOCUS_LENGTHS = [15, 25, 50];
export const DEFAULT_FOCUS_MINUTES = 25;
export const MAX_FOCUS_MINUTES = 8 * 60;
/** Lengths a check-in's Not yet offers, in minutes. */
export const MORE_TIME_CHOICES = [30, 60, 120];
export const MAX_FOCUS_TITLE = 200;

export interface Focus {
  id: string;
  todoId: string | null;
  title: string;
  /** Countdown length in ms, or null for a stopwatch. */
  lengthMs: number | null;
  startedAt: number;
  /** When the current running stretch began; null while paused. */
  runningSince: number | null;
  /** Focused time before the current running stretch. */
  bankedMs: number;
}

export interface FocusState {
  focus: Focus | null;
  /** A countdown that ended and waits for Dan's answer (Done, +5 min, Not yet). */
  checkIn: Focus | null;
}

export type FocusOutcome = 'done' | 'not-yet' | 'stopped' | 'ended';

/** A finished focus, kept for the weekly stats. */
export interface FocusRecord {
  id: string;
  todoId: string | null;
  title: string;
  countdown: boolean;
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  outcome: FocusOutcome;
}

export interface FocusStart {
  id: string;
  todoId: string | null;
  title: string;
  /** null = stopwatch. */
  minutes: number | null;
}

export type FocusAction =
  | { kind: 'pause' }
  | { kind: 'resume' }
  /** +5 min: longer countdown, or five more minutes after a check-in. */
  | { kind: 'add' }
  /** Stop a focus, or close a check-in without changing the to-do. */
  | { kind: 'stop' }
  /** Finish and tick the to-do off. */
  | { kind: 'done' }
  /** Finish at a check-in; the to-do needs `minutes` more planned. */
  | { kind: 'not-yet'; minutes: number };

export interface FocusChange {
  state: FocusState;
  /** The focus this change finished, to save in the log. */
  finished?: FocusRecord;
}

export const NO_FOCUS: FocusState = { focus: null, checkIn: null };

export function focusedMs(focus: Focus | null, now: number): number {
  if (!focus) return 0;
  return focus.bankedMs + (focus.runningSince === null ? 0 : Math.max(0, now - focus.runningSince));
}

/** Time left on a countdown (never below 0), or null for a stopwatch. */
export function remainingMs(focus: Focus, now: number): number | null {
  return focus.lengthMs === null ? null : Math.max(0, focus.lengthMs - focusedMs(focus, now));
}

/** A frozen copy: what was focused up to `now`, not running. */
const frozen = (focus: Focus, now: number): Focus => ({ ...focus, bankedMs: focusedMs(focus, now), runningSince: null });

const record = (focus: Focus, outcome: FocusOutcome, now: number): FocusRecord => ({
  id: focus.id,
  todoId: focus.todoId,
  title: focus.title,
  countdown: focus.lengthMs !== null,
  startedAt: focus.startedAt,
  endedAt: now,
  focusedMs: focusedMs(focus, now),
  outcome,
});

/** Starts a focus; one already running is recorded as stopped, an unanswered check-in as ended. */
export function startFocus(state: FocusState, start: FocusStart, now: number): FocusChange {
  const replaced = state.focus ? record(state.focus, 'stopped', now) : state.checkIn ? record(state.checkIn, 'ended', now) : undefined;
  const focus: Focus = {
    id: start.id,
    todoId: start.todoId,
    title: start.title,
    lengthMs: start.minutes === null ? null : start.minutes * MINUTE_MS,
    startedAt: now,
    runningSince: now,
    bankedMs: 0,
  };
  return { state: { focus, checkIn: null }, ...(replaced ? { finished: replaced } : {}) };
}

/** Applies one of Dan's actions; one that makes no sense right now leaves the state as it is. */
export function actOnFocus(state: FocusState, action: FocusAction, now: number): FocusChange {
  const { focus, checkIn } = state;
  const unchanged = { state };
  switch (action.kind) {
    case 'pause':
      return focus && focus.runningSince !== null ? { state: { ...state, focus: frozen(focus, now) } } : unchanged;
    case 'resume':
      return focus && focus.runningSince === null ? { state: { ...state, focus: { ...focus, runningSince: now } } } : unchanged;
    case 'add':
      if (focus && focus.lengthMs !== null) return { state: { ...state, focus: { ...focus, lengthMs: focus.lengthMs + ADD_MS } } };
      if (checkIn) return { state: { focus: { ...checkIn, lengthMs: checkIn.bankedMs + ADD_MS, runningSince: now }, checkIn: null } };
      return unchanged;
    case 'stop':
      // At a check-in, Stop closes it and leaves the to-do as it is.
      if (checkIn) return { state: NO_FOCUS, finished: record(checkIn, 'ended', now) };
      return focus ? { state: NO_FOCUS, finished: record(focus, 'stopped', now) } : unchanged;
    case 'done':
    case 'not-yet': {
      const current = focus ?? checkIn;
      if (!current || (action.kind === 'not-yet' && !checkIn)) return unchanged;
      return { state: NO_FOCUS, finished: record(current, action.kind, now) };
    }
  }
}

/** Moves a countdown whose time is up into a check-in; `ended` is true only on the tick it happens. */
export function tickFocus(state: FocusState, now: number): FocusChange & { ended: boolean } {
  const { focus } = state;
  if (!focus || remainingMs(focus, now) !== 0) return { state, ended: false };
  const final = { ...frozen(focus, now), bankedMs: focus.lengthMs ?? 0 };
  return { state: { focus: null, checkIn: final }, ended: true };
}

/** "18:42", or "1:05:03" from an hour; partial seconds round up, so a countdown shows 0:00 only when it's over. */
export function clockLabel(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** What's saved in userData/focus.json: the focus (so it survives a restart), the log for stats, and whether the island is on. */
export interface FocusSaved {
  state: FocusState;
  log: FocusRecord[];
  island: boolean;
  /** When VISION was last running with a focus going (saved every minute), to pause it there after a quit or crash. */
  aliveAt: number | null;
}

/** After a restart: a focus that was running stops counting at the moment VISION was last alive, and waits paused. */
export function pauseAtLastAlive(state: FocusState, aliveAt: number | null): FocusState {
  const { focus } = state;
  if (!focus || focus.runningSince === null || aliveAt === null) return state;
  return { ...state, focus: frozen(focus, Math.max(aliveAt, focus.runningSince)) };
}

/** Finished focuses kept for the stats. */
export const MAX_FOCUS_LOG = 5_000;

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_FOCUS_TITLE;
const OUTCOMES: FocusOutcome[] = ['done', 'not-yet', 'stopped', 'ended'];

function toFocus(raw: unknown): Focus | null {
  if (!isObj(raw)) return null;
  const { id, todoId, title, lengthMs, startedAt, runningSince, bankedMs } = raw;
  if (!isText(id) || !(todoId === null || isText(todoId)) || !isText(title) || !(lengthMs === null || isTime(lengthMs))) return null;
  if (!isTime(startedAt) || !(runningSince === null || isTime(runningSince)) || !isTime(bankedMs)) return null;
  return { id, todoId, title, lengthMs, startedAt, runningSince, bankedMs };
}

function toRecord(raw: unknown): FocusRecord[] {
  if (!isObj(raw)) return [];
  const { id, todoId, title, countdown, startedAt, endedAt, focusedMs: focused, outcome } = raw;
  if (!isText(id) || !(todoId === null || isText(todoId)) || !isText(title) || typeof countdown !== 'boolean') return [];
  if (!isTime(startedAt) || !isTime(endedAt) || !isTime(focused) || !OUTCOMES.includes(outcome as FocusOutcome)) return [];
  return [{ id, todoId, title, countdown, startedAt, endedAt, focusedMs: focused, outcome: outcome as FocusOutcome }];
}

/** The saved file as VISION can use it: anything malformed is dropped, never trusted. */
export function normalizeFocusSaved(raw: unknown): FocusSaved {
  const value = isObj(raw) ? raw : {};
  const state = isObj(value['state']) ? value['state'] : {};
  return {
    state: { focus: toFocus(state['focus']), checkIn: toFocus(state['checkIn']) },
    log: (Array.isArray(value['log']) ? value['log'].flatMap(toRecord) : []).slice(-MAX_FOCUS_LOG),
    island: typeof value['island'] === 'boolean' ? value['island'] : true,
    aliveAt: isTime(value['aliveAt']) ? value['aliveAt'] : null,
  };
}

const SIMPLE_ACTIONS = ['pause', 'resume', 'add', 'stop', 'done'] as const;
const isWholeIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** An action sent by a window, or null if it isn't one. */
export function toFocusAction(raw: unknown): FocusAction | null {
  if (!isObj(raw)) return null;
  const kind = raw['kind'];
  const simple = SIMPLE_ACTIONS.find((name) => name === kind);
  if (simple) return { kind: simple };
  // Up to 40 hours, the most a plan can hold.
  if (kind === 'not-yet' && isWholeIn(raw['minutes'], 5, 40 * 60)) return { kind, minutes: raw['minutes'] };
  return null;
}

/** A focus length sent by a window: whole minutes, null for a stopwatch, or false if it isn't valid. */
export function toFocusMinutes(raw: unknown): number | null | false {
  if (raw === null) return null;
  return isWholeIn(raw, 1, MAX_FOCUS_MINUTES) ? raw : false;
}
