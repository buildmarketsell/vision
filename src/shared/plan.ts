/**
 * Auto-scheduling, like Motion: to-dos with a duration get planned into free time on Dan's calendar.
 * The planning itself is in `autoSchedule.ts`; this file holds the shapes and the saved settings.
 */

export type Priority = 'asap' | 'high' | 'medium' | 'low';
export const PRIORITIES: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: 'asap', label: 'ASAP' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/** Which hours a task may be planned in: Dan's job (9–17) or his own projects (evenings, weekends). */
export type HoursName = 'work' | 'personal';
export const HOURS_NAMES: ReadonlyArray<{ value: HoursName; label: string }> = [
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
];

/** One time range per weekday, 0 = Sunday … 6 = Saturday, as "HH:MM"; a missing day has no hours. */
export type WeekHours = Partial<Record<number, { from: string; to: string }>>;

/** What a to-do needs to be auto-scheduled. */
export interface TodoPlan {
  minutes: number;
  priority: Priority;
  hours: HoursName;
  /** Milliseconds since 1970, or null for no deadline. */
  deadline: number | null;
  /** A hard deadline must be met; a soft one only makes the task more urgent as it gets close. */
  hardDeadline: boolean;
  /** Smallest piece a long task is split into, in minutes; 0 = never split. */
  minChunk: number;
}

export interface PlanSettings {
  /** Off = nothing is planned and VISION's blocks are taken off Google. */
  enabled: boolean;
  hours: Record<HoursName, WeekHours>;
  /** The Google calendar the blocks are copied into, or null to show them only in VISION. */
  calendarKey: string | null;
}

/** A stretch of time planned for one to-do. */
export interface PlanBlock {
  taskId: string;
  title: string;
  hours: HoursName;
  start: number;
  end: number;
}

/** A to-do the plan can't fit: late, or no room in the next two weeks. */
export interface PlanRisk {
  taskId: string;
  title: string;
  kind: 'late' | 'no-room';
  deadline: number | null;
  /** When its last block ends, if any part was planned. */
  plannedEnd: number | null;
  unplannedMinutes: number;
}

export interface PlanState {
  settings: PlanSettings;
  /** Sorted by start; blocks that already ended are kept as a record. */
  blocks: PlanBlock[];
  risks: PlanRisk[];
  plannedAt: number | null;
  /** Copying to Google failed; the plan itself still shows in VISION. */
  error?: string;
}

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
export const CHUNKS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "Don't split" },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];
export const MAX_PLAN_MINUTES = 40 * 60;
/** The plan a to-do gets when Dan first schedules it (the To-do page) or says it needs more time (a focus check-in). */
export const DEFAULT_TODO_PLAN: TodoPlan = { minutes: 60, priority: 'medium', hours: 'personal', deadline: null, hardDeadline: false, minChunk: 30 };
/** How far ahead the plan looks, in days. */
export const PLAN_DAYS = 14;

const weekdays = (from: string, to: string, days: number[]): WeekHours => Object.fromEntries(days.map((day) => [day, { from, to }]));

/** Dan's hours (2026-11-21): his job 9–17 on weekdays; his own projects in the evening and on weekend mornings, so there's time left to live. */
export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  enabled: true,
  hours: {
    work: weekdays('09:00', '17:00', [1, 2, 3, 4, 5]),
    personal: { ...weekdays('18:30', '21:30', [1, 2, 3, 4, 5]), ...weekdays('10:00', '13:00', [0, 6]) },
  },
  calendarKey: null,
};

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isPriority = (value: unknown): value is Priority => PRIORITIES.some((item) => item.value === value);
export const isHoursName = (value: unknown): value is HoursName => HOURS_NAMES.some((item) => item.value === value);

/** "HH:MM" as minutes from midnight. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function normalizeWeek(raw: unknown): WeekHours {
  if (!isObj(raw)) return {};
  const week: WeekHours = {};
  for (let day = 0; day < 7; day += 1) {
    const range = raw[day];
    if (!isObj(range) || typeof range['from'] !== 'string' || typeof range['to'] !== 'string') continue;
    if (TIME.test(range['from']) && TIME.test(range['to']) && range['from'] < range['to']) week[day] = { from: range['from'], to: range['to'] };
  }
  return week;
}

/** Settings from the saved file or the page; anything malformed falls back to the defaults. */
export function normalizePlanSettings(raw: unknown): PlanSettings {
  if (!isObj(raw)) return DEFAULT_PLAN_SETTINGS;
  const hours = isObj(raw['hours']) ? raw['hours'] : {};
  return {
    enabled: typeof raw['enabled'] === 'boolean' ? raw['enabled'] : true,
    hours: {
      work: 'work' in hours ? normalizeWeek(hours['work']) : DEFAULT_PLAN_SETTINGS.hours.work,
      personal: 'personal' in hours ? normalizeWeek(hours['personal']) : DEFAULT_PLAN_SETTINGS.hours.personal,
    },
    calendarKey: typeof raw['calendarKey'] === 'string' && raw['calendarKey'].length <= 600 ? raw['calendarKey'] : null,
  };
}

/** A to-do's plan from the saved file or the page, or null if it isn't a valid one. */
export function normalizeTodoPlan(raw: unknown): TodoPlan | null {
  if (!isObj(raw)) return null;
  const { minutes, priority, hours, deadline, hardDeadline, minChunk } = raw;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 5 || minutes > MAX_PLAN_MINUTES) return null;
  const validDeadline = typeof deadline === 'number' && Number.isFinite(deadline) ? deadline : null;
  return {
    minutes,
    priority: isPriority(priority) ? priority : 'medium',
    hours: isHoursName(hours) ? hours : 'personal',
    deadline: validDeadline,
    hardDeadline: validDeadline !== null && hardDeadline === true,
    minChunk: typeof minChunk === 'number' && CHUNKS.some((chunk) => chunk.value === minChunk) ? minChunk : 30,
  };
}

/** "1h 30m", "45m". */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
