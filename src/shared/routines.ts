/** Routines: a message an agent gets on a schedule. Times are the Mac's local time. Words in GLOSSARY.md. */

export const ROUTINE_REPEATS = ['daily', 'weekdays', 'weekly'] as const;
export type RoutineRepeat = (typeof ROUTINE_REPEATS)[number];

export interface Routine {
  id: string;
  agentId: string;
  prompt: string;
  repeat: RoutineRepeat;
  /** "HH:MM", 24-hour. */
  time: string;
  /** 0 = Sunday … 6 = Saturday; used by weekly. */
  weekday: number;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
}

/** A new routine (no id) or a change to one. */
export type RoutineInput = Partial<Pick<Routine, 'id' | 'agentId' | 'prompt' | 'repeat' | 'time' | 'weekday' | 'enabled'>>;

/** The saved list after adding or changing one routine; unchanged if the input is invalid. */
export function applyRoutineInput(routines: Routine[], input: unknown, newId: string, now: number): Routine[] {
  if (typeof input !== 'object' || input === null) return routines;
  const raw = input as Record<string, unknown>;
  const allowed = ['agentId', 'prompt', 'repeat', 'time', 'weekday', 'enabled'];
  const picked = Object.fromEntries(Object.entries(raw).filter(([key]) => allowed.includes(key)));
  const existing = typeof raw['id'] === 'string' ? routines.find((routine) => routine.id === raw['id']) : undefined;
  const base = existing ?? { id: newId, repeat: 'daily', time: '09:00', weekday: 1, enabled: true, createdAt: now, lastRunAt: null };
  // A changed time counts from now, so moving 09:00 to 08:00 at 08:30 doesn't fire at once.
  const timing = existing && (picked['time'] !== undefined || picked['repeat'] !== undefined || picked['weekday'] !== undefined) ? { lastRunAt: now } : {};
  const routine = normalizeRoutines([{ ...base, ...picked, ...timing }])[0];
  if (!routine) return routines;
  return existing ? routines.map((item) => (item.id === routine.id ? routine : item)) : [...routines, routine].slice(-MAX_ROUTINES);
}

export const MAX_ROUTINES = 100;
const MAX_PROMPT = 4000;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function runsOn(routine: Routine, day: Date): boolean {
  const weekday = day.getDay();
  if (routine.repeat === 'weekdays') return weekday >= 1 && weekday <= 5;
  if (routine.repeat === 'weekly') return weekday === routine.weekday;
  return true;
}

/** The first run strictly after `after`. */
export function nextRunAt(routine: Routine, after: number): number {
  const match = TIME.exec(routine.time);
  const hour = Number(match?.[1] ?? 9);
  const minute = Number(match?.[2] ?? 0);
  const day = new Date(after);
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, hour, minute);
    if (candidate.getTime() > after && runsOn(routine, candidate)) return candidate.getTime();
  }
  return Number.POSITIVE_INFINITY;
}

/** Routines whose next run has come. A run missed while VISION was closed is due once; its last run then moves to now. */
export function dueRoutines(routines: Routine[], now: number): Routine[] {
  return routines.filter((routine) => routine.enabled && nextRunAt(routine, routine.lastRunAt ?? routine.createdAt) <= now);
}

export function describeSchedule(routine: Routine): string {
  if (routine.repeat === 'weekdays') return `Weekdays at ${routine.time}`;
  if (routine.repeat === 'weekly') return `${WEEKDAY_NAMES[routine.weekday] ?? 'Monday'}s at ${routine.time}`;
  return `Every day at ${routine.time}`;
}

export function isRoutineTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

export function cleanRoutinePrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const prompt = value.trim().slice(0, MAX_PROMPT);
  return prompt || null;
}

function normalizeRoutine(value: unknown): Routine | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const prompt = cleanRoutinePrompt(raw['prompt']);
  const repeat = ROUTINE_REPEATS.find((item) => item === raw['repeat']);
  const weekday = raw['weekday'];
  if (typeof raw['id'] !== 'string' || typeof raw['agentId'] !== 'string' || !prompt || !repeat || !isRoutineTime(raw['time'])) return null;
  return {
    id: raw['id'],
    agentId: raw['agentId'],
    prompt,
    repeat,
    time: raw['time'],
    weekday: typeof weekday === 'number' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 1,
    enabled: raw['enabled'] !== false,
    createdAt: typeof raw['createdAt'] === 'number' ? raw['createdAt'] : 0,
    lastRunAt: typeof raw['lastRunAt'] === 'number' ? raw['lastRunAt'] : null,
  };
}

export function normalizeRoutines(raw: unknown): Routine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRoutine).filter((routine): routine is Routine => routine !== null).slice(0, MAX_ROUTINES);
}
