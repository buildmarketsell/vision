import { describe, expect, it } from 'vitest';
import { toCalendarEvent, toCalendarInfo } from '../../src/features/calendar/main/googleApi';
import { toGoogleEvent, toNewEventInput, type NewEventInput } from '../../src/shared/calendar';

const form = (change: Partial<NewEventInput> = {}): NewEventInput => ({
  calendarKey: 'dan@example.com|dan@example.com',
  title: 'Garage',
  location: '',
  date: '2026-12-03',
  allDay: false,
  startTime: '09:00',
  endTime: '10:30',
  ...change,
});

describe('new events', () => {
  it('builds a timed event in the Mac time zone and an all-day one ending the next day', () => {
    expect(toGoogleEvent(form({ location: ' Technowagen ' }), 'Europe/Madrid')).toEqual({
      body: {
        summary: 'Garage',
        location: 'Technowagen',
        start: { dateTime: '2026-12-03T09:00:00', timeZone: 'Europe/Madrid' },
        end: { dateTime: '2026-12-03T10:30:00', timeZone: 'Europe/Madrid' },
      },
    });
    expect(toGoogleEvent(form({ allDay: true, date: '2026-12-31' }), 'Europe/Madrid')).toEqual({
      body: { summary: 'Garage', start: { date: '2026-12-31' }, end: { date: '2027-01-01' } },
    });
  });

  it('says what to fix', () => {
    expect(toGoogleEvent(form({ title: '  ' }), 'UTC')).toEqual({ error: 'Give the event a name.' });
    expect(toGoogleEvent(form({ endTime: '08:00' }), 'UTC')).toEqual({ error: 'The end must be after the start.' });
    expect(toGoogleEvent(form({ date: 'tomorrow' }), 'UTC')).toEqual({ error: 'Pick a date.' });
  });

  it('refuses form data that is not text', () => {
    expect(toNewEventInput({ ...form(), title: 42 })).toBeNull();
    expect(toNewEventInput('junk')).toBeNull();
    expect(toNewEventInput(form())).toEqual(form());
  });
});

describe('reading Google calendars', () => {
  const calendar = toCalendarInfo('dan@example.com', { id: 'family', summary: 'Family', backgroundColor: '#33b679', accessRole: 'reader', selected: false }, {});

  it('maps calendars, keeping Google’s hidden ones hidden unless Dan chose otherwise', () => {
    expect(calendar).toMatchObject({ key: 'dan@example.com|family', name: 'Family', color: '#33b679', writable: false, visible: false });
    expect(toCalendarInfo('dan@example.com', { id: 'family', selected: false }, { 'dan@example.com|family': true })?.visible).toBe(true);
  });

  it('maps timed and all-day events and skips cancelled ones', () => {
    if (!calendar) throw new Error('no calendar');
    const timed = toCalendarEvent({ id: 'a', summary: 'Call', start: { dateTime: '2026-11-23T16:30:00+01:00' }, end: { dateTime: '2026-11-23T17:00:00+01:00' } }, calendar);
    expect(timed).toMatchObject({ title: 'Call', allDay: false, start: Date.parse('2026-11-23T15:30:00Z'), color: '#33b679' });
    const allDay = toCalendarEvent({ id: 'b', start: { date: '2026-12-03' }, end: { date: '2026-12-04' } }, calendar);
    expect(allDay).toMatchObject({ title: '(No title)', allDay: true, start: new Date(2026, 11, 3).getTime() });
    expect(toCalendarEvent({ id: 'c', status: 'cancelled', start: { date: '2026-12-03' } }, calendar)).toBeNull();
  });
});
