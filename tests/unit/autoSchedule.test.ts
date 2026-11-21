import { describe, expect, it } from 'vitest';
import { autoSchedule, type PlanTask } from '../../src/shared/autoSchedule';
import { DEFAULT_PLAN_SETTINGS, normalizePlanSettings, normalizeTodoPlan, type PlanSettings } from '../../src/shared/plan';
import { hoursWindows, subtract } from '../../src/shared/planWindows';

// Monday 23 November 2026, local time.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, 23 + day, hour, minute).getTime();
const MONDAY_8AM = at(0, 8);
const settings: PlanSettings = DEFAULT_PLAN_SETTINGS;

let created = 0;
const task = (id: string, fields: Partial<PlanTask> = {}): PlanTask => ({
  id,
  title: id,
  createdAt: (created += 1),
  minutes: 60,
  priority: 'medium',
  hours: 'work',
  deadline: null,
  hardDeadline: false,
  minChunk: 30,
  ...fields,
});

const plan = (tasks: PlanTask[], busy: Array<{ start: number; end: number }> = [], now = MONDAY_8AM, days = 7) =>
  autoSchedule({ tasks, busy, settings, now, days });

describe('free time', () => {
  it('builds each day from its own hours and starts no earlier than now', () => {
    const windows = hoursWindows(settings.hours.work, at(0, 10, 7), 2);
    expect(windows).toEqual([
      { start: at(0, 10, 7), end: at(0, 17) },
      { start: at(1, 9), end: at(1, 17) },
    ]);
    expect(hoursWindows(settings.hours.work, at(5, 8), 2)).toEqual([]); // Saturday and Sunday: no work hours
  });

  it('cuts meetings out of the hours', () => {
    expect(subtract([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 25, end: 40 }, { start: 90, end: 200 }])).toEqual([
      { start: 0, end: 20 },
      { start: 40, end: 90 },
    ]);
  });
});

describe('auto-schedule', () => {
  it('puts a task at the first free time in its hours, around meetings', () => {
    const { blocks, risks } = plan([task('write', { minutes: 90, minChunk: 0 })], [{ start: at(0, 9), end: at(0, 10) }]);
    expect(blocks).toEqual([{ taskId: 'write', start: at(0, 10), end: at(0, 11, 30) }]);
    expect(risks).toEqual([]);
  });

  it('plans personal tasks only in personal hours', () => {
    const { blocks } = plan([task('gym', { hours: 'personal' })]);
    expect(blocks).toEqual([{ taskId: 'gym', start: at(0, 18, 30), end: at(0, 19, 30) }]);
  });

  it('does higher priority first', () => {
    const { blocks } = plan([task('low', { priority: 'low' }), task('asap', { priority: 'asap' })]);
    expect(blocks.map((block) => block.taskId)).toEqual(['asap', 'low']);
  });

  it('splits a long task around a meeting, never leaving a piece smaller than the minimum', () => {
    const { blocks } = plan([task('big', { minutes: 120, minChunk: 30 })], [{ start: at(0, 10), end: at(0, 16) }]);
    // 9–10 is free (60 min), then 16–17 (60 min).
    expect(blocks).toEqual([
      { taskId: 'big', start: at(0, 9), end: at(0, 10) },
      { taskId: 'big', start: at(0, 16), end: at(0, 17) },
    ]);
    const unsplit = plan([task('big', { minutes: 120, minChunk: 0 })], [{ start: at(0, 10), end: at(0, 16) }]);
    expect(unsplit.blocks).toEqual([{ taskId: 'big', start: at(1, 9), end: at(1, 11) }]);
  });

  it('meets a hard deadline even when a higher priority task wants the same time', () => {
    const tasks = [
      task('urgent-ish', { priority: 'high', minutes: 480, minChunk: 0 }),
      task('report', { priority: 'low', minutes: 120, deadline: at(0, 17), hardDeadline: true }),
    ];
    const { blocks, risks } = plan(tasks);
    expect(blocks[0]).toMatchObject({ taskId: 'report', start: at(0, 9), end: at(0, 11) });
    expect(risks).toEqual([]);
  });

  it('a soft deadline two days away beats one priority step', () => {
    const tasks = [task('high', { priority: 'high' }), task('due', { priority: 'medium', deadline: at(1, 12) })];
    expect(plan(tasks).blocks[0]?.taskId).toBe('due');
  });

  it('says which tasks will be late or have no room', () => {
    const tasks = [
      task('late', { minutes: 600, minChunk: 0, deadline: at(0, 17), hardDeadline: true }),
      task('huge', { minutes: 40 * 60, minChunk: 0 }),
    ];
    const { risks } = plan(tasks, [], MONDAY_8AM, 3);
    expect(risks.map((risk) => [risk.taskId, risk.kind])).toEqual([
      ['late', 'late'],
      ['huge', 'no-room'],
    ]);
  });

  it('gives the same plan for the same input', () => {
    const tasks = [task('a'), task('b', { priority: 'high' }), task('c', { hours: 'personal' })];
    expect(plan(tasks)).toEqual(plan(tasks));
  });
});

describe('saved plan fields', () => {
  it('keeps valid plans, refuses broken ones, fixes unknown values', () => {
    expect(normalizeTodoPlan({ minutes: 60 })).toEqual({ minutes: 60, priority: 'medium', hours: 'personal', deadline: null, hardDeadline: false, minChunk: 30 });
    expect(normalizeTodoPlan({ minutes: 0 })).toBeNull();
    expect(normalizeTodoPlan({ minutes: 60, hardDeadline: true })?.hardDeadline).toBe(false); // hard needs a deadline
    expect(normalizeTodoPlan('junk')).toBeNull();
  });

  it('drops bad hours and keeps the defaults for missing settings', () => {
    const parsed = normalizePlanSettings({ hours: { work: { 1: { from: '18:00', to: '09:00' }, 2: { from: '08:00', to: '12:00' } } } });
    expect(parsed.hours.work).toEqual({ 2: { from: '08:00', to: '12:00' } });
    expect(parsed.hours.personal).toEqual(DEFAULT_PLAN_SETTINGS.hours.personal);
    expect(normalizePlanSettings(null)).toEqual(DEFAULT_PLAN_SETTINGS);
  });
});
