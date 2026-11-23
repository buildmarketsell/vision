/**
 * The glance: what the menu bar and the island show right now. One function, so the two never disagree.
 * A meeting in heads-up comes first (a running focus keeps going underneath), then a check-in, then a focus.
 */
import type { CalendarEvent } from './calendar';
import { meetingKey } from './meetings';
import { clockLabel, focusedMs, remainingMs, type FocusState } from './focus';

export type Glance =
  | { kind: 'idle' }
  | {
      kind: 'focus';
      title: string;
      /** Time left on a countdown, time so far on a stopwatch. */
      clock: string;
      /** 0 to 1 through a countdown; null for a stopwatch. */
      progress: number | null;
      paused: boolean;
      hasTodo: boolean;
    }
  | { kind: 'check-in'; title: string; hasTodo: boolean }
  | {
      kind: 'meeting';
      id: string;
      title: string;
      /** Time to its start, or "Now". */
      clock: string;
      joinUrl: string | null;
      focus: { clock: string; paused: boolean } | null;
      /** A countdown that ended and still waits for an answer, kept reachable during the meeting. */
      checkIn: { title: string; hasTodo: boolean } | null;
    };

export function glance(state: FocusState, meeting: CalendarEvent | null, now: number): Glance {
  const { focus, checkIn } = state;
  const left = focus ? remainingMs(focus, now) : null;
  const focusClock = focus ? clockLabel(left ?? focusedMs(focus, now)) : '';
  if (meeting) {
    return {
      kind: 'meeting',
      id: meetingKey(meeting),
      title: meeting.title,
      clock: now < meeting.start ? clockLabel(meeting.start - now) : 'Now',
      joinUrl: meeting.joinUrl ?? null,
      focus: focus ? { clock: focusClock, paused: focus.runningSince === null } : null,
      checkIn: checkIn ? { title: checkIn.title, hasTodo: checkIn.todoId !== null } : null,
    };
  }
  if (checkIn) return { kind: 'check-in', title: checkIn.title, hasTodo: checkIn.todoId !== null };
  if (!focus) return { kind: 'idle' };
  return {
    kind: 'focus',
    title: focus.title,
    clock: focusClock,
    progress: focus.lengthMs && left !== null ? Math.round(Math.min(1, Math.max(0, 1 - left / focus.lengthMs)) * 1000) / 1000 : null,
    paused: focus.runningSince === null,
    hasTodo: focus.todoId !== null,
  };
}
