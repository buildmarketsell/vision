import { describe, expect, it } from 'vitest';
import { groupAgenda, soonLabel } from '../../src/features/calendar/renderer/agenda';
import type { CalendarEvent } from '../../src/shared/calendar';

const HOUR = 60 * 60_000;
const local = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime();
const event = (id: string, start: number, end: number, allDay = false): CalendarEvent => ({ id, calendarKey: 'me|primary', title: id, location: null, allDay, start, end, color: '#7986cb' });

describe('agenda', () => {
  const now = local(19, 11);

  it('drops what ended, puts what is still on under Today, and labels the days', () => {
    const days = groupAgenda(
      [
        event('ended', local(19, 9), local(19, 10)),
        event('all-day today', local(19, 0), local(20, 0), true),
        event('meeting', local(19, 16), local(19, 17)),
        event('tomorrow', local(20, 9), local(20, 10)),
        event('later', local(23, 16), local(23, 17)),
      ],
      now,
    );
    expect(days.map((day) => day.label)).toEqual(['Today', 'Tomorrow', new Date(local(23, 0)).toLocaleDateString(undefined, { weekday: 'long' })]);
    expect(days[0]?.events.map((item) => item.id)).toEqual(['all-day today', 'meeting']);
  });

  it('says Now or how soon, only for the next few hours', () => {
    expect(soonLabel(event('on', now - HOUR, now + HOUR), now)).toBe('Now');
    expect(soonLabel(event('soon', now + 25 * 60_000, now + HOUR), now)).toBe('in 25 min');
    expect(soonLabel(event('later', now + 2 * HOUR, now + 3 * HOUR), now)).toBe('in 2 h');
    expect(soonLabel(event('far', now + 8 * HOUR, now + 9 * HOUR), now)).toBeNull();
  });
});
