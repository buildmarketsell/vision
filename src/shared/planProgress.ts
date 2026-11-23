/**
 * How much of each to-do is still to plan. Time VISION planned that has already passed counts as worked, so a 3-hour
 * task done in 1-hour pieces shrinks after each piece instead of being planned in full again. A to-do whose planned
 * time has all passed but isn't ticked off rolls over: it gets one more piece at the next free moment, again and again
 * until Dan ticks it off (Dan, 2026-11-23).
 */
import type { PlanTask } from './autoSchedule';
import type { PlanBlock } from './plan';
import type { TodoItem } from './todos';

const MINUTE_MS = 60_000;
/** Past blocks are kept this long: the week page shows them as a record. */
const KEEP_PAST_MS = 30 * 24 * 60 * MINUTE_MS;
/** The extra piece for a to-do that is never split (its smallest piece is the whole task). */
const ROLLOVER_UNSPLIT_MINUTES = 30;

export interface Progress {
  /** Blocks that have ended, for to-dos that still have a plan. */
  past: PlanBlock[];
  /** Blocks under way right now: they stay where they are. */
  started: PlanBlock[];
  /** What's left to plan, per open to-do (a rolled-over one asks for one more piece). */
  tasks: PlanTask[];
}

const blockKey = (block: PlanBlock) => `${block.taskId}|${block.start}`;
const minutesIn = (blocks: PlanBlock[], id: string) => blocks.filter((block) => block.taskId === id).reduce((sum, block) => sum + (block.end - block.start) / MINUTE_MS, 0);

export function planProgress(todos: TodoItem[], previous: PlanBlock[], past: PlanBlock[], now: number, enabled: boolean): Progress {
  const planned = new Map(todos.filter((todo) => todo.plan).map((todo) => [todo.id, todo]));
  const ended = new Map<string, PlanBlock>();
  for (const block of [...past, ...previous]) {
    if (block.end <= now && block.end > now - KEEP_PAST_MS && planned.has(block.taskId)) ended.set(blockKey(block), block);
  }
  const keptPast = [...ended.values()].sort((a, b) => a.start - b.start);
  const open = [...planned.values()].filter((todo) => todo.status !== 'done');
  const openIds = new Set(open.map((todo) => todo.id));
  const started = enabled ? previous.filter((block) => block.start <= now && block.end > now && openIds.has(block.taskId)) : [];

  const tasks: PlanTask[] = [];
  for (const todo of open) {
    if (!todo.plan) continue;
    const worked = minutesIn(keptPast, todo.id);
    const underWay = minutesIn(started, todo.id);
    const left = Math.round(todo.plan.minutes - worked - underWay);
    const rollover = worked >= todo.plan.minutes && underWay === 0 ? todo.plan.minChunk || ROLLOVER_UNSPLIT_MINUTES : 0;
    const minutes = left > 0 ? left : rollover;
    if (minutes > 0) tasks.push({ ...todo.plan, minutes, id: todo.id, title: todo.text, createdAt: todo.createdAt });
  }
  return { past: keptPast, started, tasks };
}
