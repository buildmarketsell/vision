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
      if (focus?.lengthMs != null) return { state: { ...state, focus: { ...focus, lengthMs: focus.lengthMs + ADD_MS } } };
      if (checkIn) return { state: { focus: { ...checkIn, lengthMs: checkIn.bankedMs + ADD_MS, runningSince: now }, checkIn: null } };
      return unchanged;
    case 'stop':
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
