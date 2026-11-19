import { describe, expect, it } from 'vitest';
import { eventsBetween } from '../../src/features/calendar/main/ics';
import { cleanCalendarUrl, isCalendarUrl } from '../../src/shared/calendar';

/** Shaped like Google's export: a time zone, a weekly meeting with one moved week, an all-day event, a past one. */
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:Europe/Madrid
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:weekly@google.com
DTSTART;TZID=Europe/Madrid:20260105T163000
DTEND;TZID=Europe/Madrid:20260105T173000
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Weekly Plan
END:VEVENT
BEGIN:VEVENT
UID:weekly@google.com
RECURRENCE-ID;TZID=Europe/Madrid:20261130T163000
DTSTART;TZID=Europe/Madrid:20261201T163000
DTEND;TZID=Europe/Madrid:20261201T173000
SUMMARY:Weekly Plan (moved)
END:VEVENT
BEGIN:VEVENT
UID:garage@google.com
DTSTART;VALUE=DATE:20261203
DTEND;VALUE=DATE:20261204
SUMMARY:Garage: fit the spiral
LOCATION:Technowagen
END:VEVENT
BEGIN:VEVENT
UID:old@google.com
DTSTART:20250101T100000Z
DTEND:20250101T110000Z
SUMMARY:Long gone
END:VEVENT
END:VCALENDAR`;

const at = (iso: string) => new Date(iso).getTime();

describe('eventsBetween', () => {
  const events = eventsBetween(ICS, at('2026-11-19T00:00:00Z'), at('2026-12-04T00:00:00Z'));

  it('expands repeats in the right time zone, honours a moved week, and keeps all-day events', () => {
    expect(events.map((event) => event.title)).toEqual(['Weekly Plan', 'Weekly Plan (moved)', 'Garage: fit the spiral']);
    expect(events[0]?.start).toBe(at('2026-11-23T15:30:00Z'));
    expect(events[1]?.start).toBe(at('2026-12-01T15:30:00Z'));
    expect(events[2]).toMatchObject({ allDay: true, location: 'Technowagen' });
  });

  it('gives every occurrence its own id', () => {
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });

  it('rejects text that is not a calendar', () => {
    expect(() => eventsBetween('<html>nope</html>', 0, 1)).toThrow();
  });
});

describe('calendar links', () => {
  it('accepts https and webcal links only', () => {
    expect(isCalendarUrl('https://calendar.google.com/calendar/ical/x/private-y/basic.ics')).toBe(true);
    expect(isCalendarUrl('http://example.com/a.ics')).toBe(false);
    expect(isCalendarUrl('not a link')).toBe(false);
    expect(cleanCalendarUrl(' webcal://p01.example.com/a.ics ')).toBe('https://p01.example.com/a.ics');
  });
});
