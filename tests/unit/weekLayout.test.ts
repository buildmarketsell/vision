import { describe, expect, it } from 'vitest';
import { addDays, allDayOn, clickRange, clockTime, dragRange, layoutDay, minutesAt, startOfWeek, weekDays } from '../../src/features/calendar/renderer/weekLayout';
import type { CalendarEvent } from '../../src/shared/calendar';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const event = (id: string, start: number, end: number, allDay = false): CalendarEvent => ({ id, calendarKey: 'k', title: id, location: null, allDay, start, end, color: '#7986cb' });

describe('week layout', () => {
  it('starts weeks on Monday and lists seven days', () => {
    const monday = startOfWeek(at(19, 15));
    expect(new Date(monday).getDay()).toBe(1);
    expect(new Date(monday).getDate()).toBe(16);
    expect(weekDays(monday).map((day) => new Date(day).getDate())).toEqual([16, 17, 18, 19, 20, 21, 22]);
  });

  it('places events by minutes and splits overlapping ones into columns', () => {
    const day = at(23, 0);
    const placed = layoutDay(
      [event('a', at(23, 9), at(23, 10)), event('b', at(23, 9, 30), at(23, 11)), event('c', at(23, 14), at(23, 15)), event('allday', day, addDays(day, 1), true)],
      day,
    );
    expect(placed.map((piece) => [piece.event.id, piece.top, piece.height, piece.column, piece.columns])).toEqual([
      ['a', 540, 60, 0, 2],
      ['b', 570, 90, 1, 2],
      ['c', 840, 60, 0, 1],
    ]);
  });

  it('cuts an event that runs past midnight and keeps tiny ones readable', () => {
    const late = layoutDay([event('late', at(23, 23), at(24, 1)), event('tiny', at(23, 8), at(23, 8, 5))], at(23, 0));
    expect(late.find((piece) => piece.event.id === 'late')).toMatchObject({ top: 1380, height: 60 });
    expect(late.find((piece) => piece.event.id === 'tiny')?.height).toBe(20);
    expect(layoutDay([event('late', at(23, 23), at(24, 1))], at(24, 0))[0]).toMatchObject({ top: 0, height: 60 });
  });

  it('shows a two-day all-day event on both days', () => {
    const trip = event('trip', at(23, 0), at(25, 0), true);
    expect(allDayOn([trip], at(23, 0))).toHaveLength(1);
    expect(allDayOn([trip], at(24, 0))).toHaveLength(1);
    expect(allDayOn([trip], at(25, 0))).toHaveLength(0);
  });
});

describe('drag to pick a time', () => {
  const HOUR = 48;
  it('snaps the pointer to quarter hours inside the day', () => {
    expect(minutesAt(16 * HOUR + 10, HOUR, 15)).toBe(16 * 60);
    expect(minutesAt(-30, HOUR, 15)).toBe(0);
    expect(minutesAt(30 * HOUR, HOUR, 15)).toBe(23 * 60 + 45);
  });

  it('covers the quarter hours at both ends, dragging down or up', () => {
    expect(dragRange(16 * 60, 17 * 60 + 15)).toEqual({ start: 960, end: 1050 });
    expect(dragRange(17 * 60 + 15, 16 * 60)).toEqual({ start: 960, end: 1050 });
    expect(dragRange(16 * 60, 16 * 60)).toEqual({ start: 960, end: 975 });
    expect(dragRange(23 * 60 + 45, 23 * 60 + 45)).toEqual({ start: 1425, end: 1440 });
  });

  it('turns a click into an hour and writes times the form accepts', () => {
    expect(clickRange(16 * HOUR + 30, HOUR)).toEqual({ start: 990, end: 1050 });
    expect(clickRange(23 * HOUR + 30, HOUR)).toEqual({ start: 1410, end: 1440 });
    expect(clockTime(990)).toBe('16:30');
    expect(clockTime(1440)).toBe('23:59');
  });
});
