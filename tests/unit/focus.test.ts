import { describe, expect, it } from 'vitest';
import { actOnFocus, clockLabel, focusedMs, NO_FOCUS, normalizeFocusSaved, pauseAtLastAlive, startFocus, tickFocus, toFocusAction, toFocusMinutes, type FocusState } from '../../src/shared/focus';

const MIN = 60_000;
const T0 = 1_000_000_000_000;
const countdown = (minutes = 25, todoId: string | null = 'vsl') => startFocus(NO_FOCUS, { id: 'f1', todoId, title: 'Write VSL', minutes }, T0).state;

describe('focus clock', () => {
  it('counts focused time from timestamps', () => {
    const state = countdown();
    expect(focusedMs(state.focus, T0 + 7 * MIN)).toBe(7 * MIN);
  });

  it('does not count paused time, and resumes where it stopped', () => {
    let state = countdown();
    state = actOnFocus(state, { kind: 'pause' }, T0 + 5 * MIN).state;
    expect(focusedMs(state.focus, T0 + 50 * MIN)).toBe(5 * MIN);
    state = actOnFocus(state, { kind: 'resume' }, T0 + 50 * MIN).state;
    expect(focusedMs(state.focus, T0 + 52 * MIN)).toBe(7 * MIN);
  });

  it('ends a countdown exactly once, into a check-in, and records it', () => {
    const state = countdown(25);
    expect(tickFocus(state, T0 + 24 * MIN).ended).toBe(false);
    const ended = tickFocus(state, T0 + 25 * MIN);
    expect(ended.ended).toBe(true);
    expect(ended.state.focus).toBeNull();
    expect(ended.state.checkIn?.todoId).toBe('vsl');
    expect(tickFocus(ended.state, T0 + 26 * MIN).ended).toBe(false);
  });

  it('never ends a stopwatch', () => {
    const state = startFocus(NO_FOCUS, { id: 'f1', todoId: null, title: 'Focus', minutes: null }, T0).state;
    expect(tickFocus(state, T0 + 600 * MIN).ended).toBe(false);
  });

  it('adds five minutes to a running countdown', () => {
    const state = actOnFocus(countdown(25), { kind: 'add' }, T0 + MIN).state;
    expect(tickFocus(state, T0 + 29 * MIN).ended).toBe(false);
    expect(tickFocus(state, T0 + 30 * MIN).ended).toBe(true);
  });

  it('+5 min at a check-in runs the same focus five more minutes', () => {
    const atCheckIn = tickFocus(countdown(25), T0 + 25 * MIN).state;
    const more = actOnFocus(atCheckIn, { kind: 'add' }, T0 + 27 * MIN).state;
    expect(more.checkIn).toBeNull();
    expect(more.focus?.id).toBe('f1');
    expect(tickFocus(more, T0 + 31 * MIN).ended).toBe(false);
    expect(tickFocus(more, T0 + 32 * MIN).ended).toBe(true);
  });

  it('records each finished focus with how it ended', () => {
    const stopped = actOnFocus(countdown(), { kind: 'stop' }, T0 + 10 * MIN);
    expect(stopped.state).toEqual(NO_FOCUS);
    expect(stopped.finished).toMatchObject({ todoId: 'vsl', focusedMs: 10 * MIN, outcome: 'stopped', endedAt: T0 + 10 * MIN });

    const atCheckIn = tickFocus(countdown(25), T0 + 25 * MIN).state;
    expect(actOnFocus(atCheckIn, { kind: 'done' }, T0 + 26 * MIN).finished).toMatchObject({ focusedMs: 25 * MIN, outcome: 'done' });
    expect(actOnFocus(atCheckIn, { kind: 'not-yet', minutes: 60 }, T0 + 26 * MIN).finished).toMatchObject({ outcome: 'not-yet' });
  });

  it('finishes a focus early with Done', () => {
    const done = actOnFocus(countdown(), { kind: 'done' }, T0 + 12 * MIN);
    expect(done.state).toEqual(NO_FOCUS);
    expect(done.finished).toMatchObject({ focusedMs: 12 * MIN, outcome: 'done' });
  });

  it('starting a new focus records the one it replaces, and an open check-in', () => {
    const running = startFocus(countdown(), { id: 'f2', todoId: null, title: 'Focus', minutes: 15 }, T0 + 5 * MIN);
    expect(running.state.focus?.id).toBe('f2');
    expect(running.finished).toMatchObject({ id: 'f1', focusedMs: 5 * MIN, outcome: 'stopped' });

    const atCheckIn = tickFocus(countdown(25), T0 + 25 * MIN).state;
    expect(startFocus(atCheckIn, { id: 'f2', todoId: null, title: 'Focus', minutes: 15 }, T0 + 30 * MIN).finished).toMatchObject({ id: 'f1', outcome: 'ended' });
  });

  it('ignores actions that make no sense right now', () => {
    const idle: FocusState = NO_FOCUS;
    expect(actOnFocus(idle, { kind: 'pause' }, T0).state).toBe(idle);
    const paused = actOnFocus(countdown(), { kind: 'pause' }, T0 + MIN).state;
    expect(actOnFocus(paused, { kind: 'pause' }, T0 + 2 * MIN).state).toBe(paused);
    const atCheckIn = tickFocus(countdown(25), T0 + 25 * MIN).state;
    expect(actOnFocus(atCheckIn, { kind: 'pause' }, T0 + 26 * MIN).state).toBe(atCheckIn);
  });
});

describe('clock label', () => {
  it('shows minutes and seconds, with hours only when needed', () => {
    expect(clockLabel(0)).toBe('0:00');
    expect(clockLabel(18 * MIN + 42_000)).toBe('18:42');
    expect(clockLabel(59_999)).toBe('1:00');
    expect(clockLabel(65 * MIN + 3_000)).toBe('1:05:03');
  });
});

describe('saved focus', () => {
  it('reads back what was saved', () => {
    const state = countdown();
    const record = actOnFocus(state, { kind: 'stop' }, T0 + MIN).finished;
    expect(normalizeFocusSaved(JSON.parse(JSON.stringify({ state, log: [record], island: false, aliveAt: T0 })))).toEqual({ state, log: [record], island: false, aliveAt: T0 });
  });

  it('starts clean from a damaged file, with the island on', () => {
    expect(normalizeFocusSaved({ state: { focus: { id: 3 } }, log: [{ bad: true }], island: 'yes' })).toEqual({ state: NO_FOCUS, log: [], island: true, aliveAt: null });
    expect(normalizeFocusSaved(null)).toEqual({ state: NO_FOCUS, log: [], island: true, aliveAt: null });
  });
});

describe('actions from a window', () => {
  it('accepts the known actions', () => {
    expect(toFocusAction({ kind: 'pause' })).toEqual({ kind: 'pause' });
    expect(toFocusAction({ kind: 'not-yet', minutes: 60 })).toEqual({ kind: 'not-yet', minutes: 60 });
  });

  it('refuses anything else', () => {
    expect(toFocusAction({ kind: 'explode' })).toBeNull();
    expect(toFocusAction({ kind: 'not-yet', minutes: 0 })).toBeNull();
    expect(toFocusAction({ kind: 'not-yet', minutes: 1.5 })).toBeNull();
    expect(toFocusAction({ kind: 'not-yet', minutes: 100_000 })).toBeNull();
    expect(toFocusAction('pause')).toBeNull();
  });

  it('accepts focus lengths from 1 minute to 8 hours, or null for a stopwatch', () => {
    expect(toFocusMinutes(25)).toBe(25);
    expect(toFocusMinutes(null)).toBeNull();
    for (const bad of [0, -5, 2.5, 481, '25', undefined]) expect(toFocusMinutes(bad)).toBe(false);
  });
});

describe('fixes from review', () => {
  it('Stop at a check-in closes it without touching the to-do, recorded as ended', () => {
    const atCheckIn = tickFocus(countdown(25), T0 + 25 * MIN).state;
    const stopped = actOnFocus(atCheckIn, { kind: 'stop' }, T0 + 40 * MIN);
    expect(stopped.state).toEqual(NO_FOCUS);
    expect(stopped.finished).toMatchObject({ id: 'f1', outcome: 'ended', focusedMs: 25 * MIN });
  });

  it('after a restart, time while VISION was closed is not focus time: the focus is paused when VISION was last alive', () => {
    const state = countdown(25);
    const back = pauseAtLastAlive(state, T0 + 10 * MIN);
    expect(back.focus?.runningSince).toBeNull();
    expect(focusedMs(back.focus, T0 + 600 * MIN)).toBe(10 * MIN);
  });

  it('leaves a paused focus, or one with no known last-alive time, as it is', () => {
    const paused = actOnFocus(countdown(25), { kind: 'pause' }, T0 + 5 * MIN).state;
    expect(pauseAtLastAlive(paused, T0 + 50 * MIN)).toBe(paused);
    const running = countdown(25);
    expect(pauseAtLastAlive(running, null)).toBe(running);
  });

  it('saves when VISION was last alive', () => {
    expect(normalizeFocusSaved({ aliveAt: T0 }).aliveAt).toBe(T0);
    expect(normalizeFocusSaved({ aliveAt: 'x' }).aliveAt).toBeNull();
  });
});
