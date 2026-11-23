import { describe, expect, it } from 'vitest';
import type { PlanBlock, TodoPlan } from '../../src/shared/plan';
import { planProgress } from '../../src/shared/planProgress';
import type { TodoItem } from '../../src/shared/todos';

const HOUR = 60 * 60_000;
const NOW = 100 * HOUR;
const plan: TodoPlan = { minutes: 180, priority: 'medium', hours: 'work', deadline: null, hardDeadline: false, minChunk: 30 };
const todo = (id: string, fields: Partial<TodoItem> = {}): TodoItem => ({ id, text: id, status: 'todo', createdAt: 1, plan, ...fields });
const block = (taskId: string, start: number, end: number): PlanBlock => ({ taskId, title: taskId, hours: 'work', start, end });

describe('plan progress', () => {
  it('takes time already planned off what is left: a 3h task after its first 1h piece has 2h left', () => {
    const progress = planProgress([todo('vsl')], [block('vsl', NOW - 2 * HOUR, NOW - HOUR), block('vsl', NOW + HOUR, NOW + 3 * HOUR)], [], NOW, true);
    expect(progress.tasks.map((task) => [task.id, task.minutes])).toEqual([['vsl', 120]]);
    expect(progress.past).toHaveLength(1);
  });

  it('keeps a piece under way where it is and counts it', () => {
    const now = block('vsl', NOW - HOUR / 2, NOW + HOUR / 2);
    const progress = planProgress([todo('vsl')], [now], [], NOW, true);
    expect(progress.started).toEqual([now]);
    expect(progress.tasks[0]?.minutes).toBe(120);
  });

  it('counts each past piece once, however often it is seen', () => {
    const piece = block('vsl', NOW - 2 * HOUR, NOW - HOUR);
    expect(planProgress([todo('vsl')], [piece], [piece], NOW, true).tasks[0]?.minutes).toBe(120);
  });

  it('rolls over a task whose planned time has all passed but is not ticked off: one more piece of its smallest size', () => {
    const progress = planProgress([todo('vsl', { plan: { ...plan, minutes: 60, minChunk: 15 } })], [], [block('vsl', NOW - 2 * HOUR, NOW - HOUR)], NOW, true);
    expect(progress.tasks.map((task) => [task.id, task.minutes, task.minChunk])).toEqual([['vsl', 15, 15]]);
  });

  it('rolls over 30 minutes when the task is never split', () => {
    const progress = planProgress([todo('vsl', { plan: { ...plan, minutes: 60, minChunk: 0 } })], [], [block('vsl', NOW - 2 * HOUR, NOW - HOUR)], NOW, true);
    expect(progress.tasks.map((task) => [task.id, task.minutes])).toEqual([['vsl', 30]]);
  });

  it('keeps rolling over after each extra piece passes', () => {
    const pieces = [block('vsl', NOW - 3 * HOUR, NOW - 2 * HOUR), block('vsl', NOW - HOUR, NOW - HOUR / 2)];
    const progress = planProgress([todo('vsl', { plan: { ...plan, minutes: 60 } })], [], pieces, NOW, true);
    expect(progress.tasks.map((task) => [task.id, task.minutes])).toEqual([['vsl', 30]]);
  });

  it('plans no extra piece while a rolled-over piece is under way', () => {
    const under = block('vsl', NOW - HOUR / 4, NOW + HOUR / 4);
    const progress = planProgress([todo('vsl', { plan: { ...plan, minutes: 60 } })], [under], [block('vsl', NOW - 2 * HOUR, NOW - HOUR)], NOW, true);
    expect(progress.tasks).toEqual([]);
    expect(progress.started).toEqual([under]);
  });

  it('forgets past pieces of to-dos taken off the calendar, and plans nothing for done ones', () => {
    const progress = planProgress([todo('gone', { plan: undefined }), todo('done', { status: 'done' })], [], [block('gone', NOW - 2 * HOUR, NOW - HOUR)], NOW, true);
    expect(progress.past).toEqual([]);
    expect(progress.tasks).toEqual([]);
  });

  it('keeps nothing under way when planning is off', () => {
    expect(planProgress([todo('vsl')], [block('vsl', NOW - HOUR, NOW + HOUR)], [], NOW, false).started).toEqual([]);
  });
});
