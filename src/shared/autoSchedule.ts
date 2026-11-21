/**
 * The auto-scheduler: puts to-dos with a duration into free working time, like Motion.
 * Adapted from Tactus (github.com/kevin-y-yu/tactus, MIT, Copyright (c) 2026 Kevin Yu), lib/scheduler.js, cut down to
 * what VISION uses: two sets of hours, priorities, hard and soft deadlines, splitting. No projects, dependencies or breaks.
 *
 * It walks the free time from now on, a quarter hour at a time, and at each moment gives the time to the most important
 * task that fits (priority, plus urgency as its deadline gets close). Before each choice it checks that every hard
 * deadline can still be met; if not, the task with the earliest hard deadline goes first.
 * Pure: same input, same plan, so re-planning without changes moves nothing.
 */
import type { HoursName, PlanRisk, PlanSettings, Priority, TodoPlan } from './plan';
import { alignInward, ceilGrid, GRID_MS, hoursWindows, MINUTE_MS, mergeOverlapping, spanAt, subtract, type Span } from './planWindows';

const DAY_MS = 24 * 60 * MINUTE_MS;
const PRIORITY_WEIGHT: Record<Priority, number> = { low: 100, medium: 200, high: 300, asap: 400 };
/** Urgency grows from 0 to this over the last two weeks before a deadline (less than one priority step)… */
const URGENCY_RAMP_MAX = 90;
const URGENCY_WINDOW_MS = 14 * DAY_MS;
/** …and in the last two days it jumps past one priority step, so a near deadline beats a higher priority. */
const LATE_WINDOW_MS = 2 * DAY_MS;
const LATE_FLOOR = 110;
const LATE_SPAN = 80;

export interface PlanTask extends TodoPlan {
  id: string;
  title: string;
  createdAt: number;
}

export interface PlannedBlock extends Span {
  taskId: string;
}

export interface PlanInput {
  tasks: PlanTask[];
  /** Meetings and anything else that's taken. */
  busy: Span[];
  settings: PlanSettings;
  now: number;
  days: number;
}

interface TaskState extends PlanTask {
  left: number;
  minPiece: number;
  lastEnd: number | null;
}

interface Context {
  free: Record<HoursName, Span[]>;
  all: Span[];
  horizonEnd: number;
}

function urgency(task: TaskState, at: number): number {
  if (task.deadline === null) return 0;
  const untilDeadline = task.deadline - at;
  if (untilDeadline <= LATE_WINDOW_MS) return LATE_FLOOR + LATE_SPAN * (1 - Math.max(0, untilDeadline) / LATE_WINDOW_MS);
  return URGENCY_RAMP_MAX * Math.min(1, Math.max(0, 1 - untilDeadline / URGENCY_WINDOW_MS));
}

const score = (task: TaskState, at: number) => PRIORITY_WEIGHT[task.priority] + urgency(task, at);

/** How much of the task to place in `room`, or 0 if it can't go here (a piece must never leave a leftover smaller than the minimum). */
function pieceLength(task: TaskState, room: number): number {
  const smallest = Math.min(task.minPiece, task.left);
  const upper = Math.min(task.left, room);
  if (upper < smallest) return 0;
  if (upper === task.left) return upper;
  if (task.left - upper >= task.minPiece) return upper;
  const shorter = task.left - task.minPiece;
  return shorter >= smallest ? shorter : 0;
}

const hasHardDeadline = (ctx: Context, task: TaskState) => task.hardDeadline && task.deadline !== null && task.deadline <= ctx.horizonEnd;

/** Can every hard deadline still be met from `from` on, if `changed` has `left` instead of its current amount? */
function hardDeadlinesFit(ctx: Context, states: TaskState[], from: number, changed: { id: string; left: number } | null): boolean {
  const pending = states.flatMap((task) => {
    const left = task.id === changed?.id ? changed.left : task.left;
    return hasHardDeadline(ctx, task) && left > 0 ? [{ deadline: task.deadline ?? 0, left, hours: task.hours }] : [];
  });
  const fits = (list: typeof pending, spans: Span[]) => {
    let demand = 0;
    for (const deadline of [...new Set(list.map((item) => item.deadline))].sort((a, b) => a - b)) {
      demand += list.filter((item) => item.deadline === deadline).reduce((sum, item) => sum + item.left, 0);
      const room = spans.reduce((sum, span) => sum + Math.max(0, Math.min(span.end, deadline) - Math.max(span.start, from)), 0);
      if (demand > room) return false;
    }
    return true;
  };
  if (pending.length === 0) return true;
  return (['work', 'personal'] as const).every((hours) => fits(pending.filter((item) => item.hours === hours), ctx.free[hours])) && fits(pending, ctx.all);
}

type Fit = { task: TaskState; length: number; score: number };
const better = (a: Fit, b: Fit) => b.score - a.score || a.task.createdAt - b.task.createdAt || (a.task.id < b.task.id ? -1 : 1);
const earlierDeadline = (a: Fit, b: Fit) => (a.task.deadline ?? Infinity) - (b.task.deadline ?? Infinity) || better(a, b);
const best = (fits: Fit[], order: (a: Fit, b: Fit) => number) => fits.reduce((pick, fit) => (order(fit, pick) < 0 ? fit : pick));

function choose(ctx: Context, states: TaskState[], fits: Fit[], at: number): Fit {
  const top = best(fits, better);
  const hard = fits.filter((fit) => hasHardDeadline(ctx, fit.task));
  if (hard.length === 0) return top;
  const firstDue = best(hard, earlierDeadline);
  if (top.task === firstDue.task) return top;
  if (!hardDeadlinesFit(ctx, states, at, null)) return firstDue;
  return hardDeadlinesFit(ctx, states, at + top.length, { id: top.task.id, left: top.task.left - top.length }) ? top : firstDue;
}

function risks(ctx: Context, states: TaskState[]): PlanRisk[] {
  return states.flatMap((task): PlanRisk[] => {
    const late = task.deadline !== null && ((task.left > 0 && task.deadline <= ctx.horizonEnd) || (task.lastEnd !== null && task.lastEnd > task.deadline));
    if (!late && task.left === 0) return [];
    return [{ taskId: task.id, title: task.title, kind: late ? 'late' : 'no-room', deadline: task.deadline, plannedEnd: task.lastEnd, unplannedMinutes: task.left / MINUTE_MS }];
  });
}

/** Plans every task into the free time of the next `days` days. */
export function autoSchedule({ tasks, busy, settings, now, days }: PlanInput): { blocks: PlannedBlock[]; risks: PlanRisk[] } {
  const from = ceilGrid(now);
  const freeIn = (hours: HoursName) => alignInward(subtract(hoursWindows(settings.hours[hours], from, days), busy));
  const free = { work: freeIn('work'), personal: freeIn('personal') };
  const all = alignInward(mergeOverlapping([...free.work, ...free.personal]));
  const lastEnd = Math.max(from, ...all.map((span) => span.end));
  const ctx: Context = { free, all, horizonEnd: lastEnd };
  const states: TaskState[] = [...tasks]
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
    .map((task) => {
      const left = task.minutes * MINUTE_MS;
      return { ...task, left, minPiece: task.minChunk === 0 ? left : task.minChunk * MINUTE_MS, lastEnd: null };
    });

  const blocks: PlannedBlock[] = [];
  for (const span of all) {
    let at = span.start;
    while (at < span.end) {
      const fits: Fit[] = [];
      for (const task of states) {
        if (task.left <= 0) continue;
        const own = spanAt(ctx.free[task.hours], at);
        const length = own ? pieceLength(task, own.end - at) : 0;
        if (length > 0) fits.push({ task, length, score: score(task, at) });
      }
      if (fits.length === 0) {
        at += GRID_MS;
        continue;
      }
      const pick = choose(ctx, states, fits, at);
      pick.task.left -= pick.length;
      pick.task.lastEnd = at + pick.length;
      const previous = blocks[blocks.length - 1];
      // Two pieces of the same task back to back are one block.
      if (previous && previous.taskId === pick.task.id && previous.end === at) previous.end += pick.length;
      else blocks.push({ taskId: pick.task.id, start: at, end: at + pick.length });
      at += pick.length;
    }
  }
  return { blocks, risks: risks(ctx, states) };
}
