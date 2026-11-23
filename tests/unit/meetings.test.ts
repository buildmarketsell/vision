import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../src/shared/calendar';
import { glance } from '../../src/shared/glance';
import { NO_FOCUS, startFocus, tickFocus, actOnFocus } from '../../src/shared/focus';
import { headsUpMeeting, joinLinkFrom, meetingKey, selfDeclined, safeJoinLink } from '../../src/shared/meetings';

const MIN = 60_000;
const T0 = 1_000_000_000_000;
const event = (id: string, start: number, fields: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, calendarKey: 'me|primary', title: id, location: null, allDay: false, start, end: start + 30 * MIN, color: '#000', ...fields,
});

describe('heads-up', () => {
  it('starts five minutes before a meeting and lasts ten minutes into it', () => {
    const call = event('call', T0);
    expect(headsUpMeeting([call], T0 - 5 * MIN - 1, new Set())).toBeNull();
    expect(headsUpMeeting([call], T0 - 5 * MIN, new Set())?.id).toBe('call');
    expect(headsUpMeeting([call], T0 + 9 * MIN, new Set())?.id).toBe('call');
    expect(headsUpMeeting([call], T0 + 10 * MIN, new Set())).toBeNull();
  });

  it('ends with a meeting shorter than ten minutes', () => {
    expect(headsUpMeeting([event('quick', T0, { end: T0 + 5 * MIN })], T0 + 5 * MIN, new Set())).toBeNull();
  });

  it('skips all-day events, events marked free, VISION’s own blocks and dismissed meetings', () => {
    const events = [event('holiday', T0, { allDay: true }), event('free', T0, { free: true }), event('block', T0, { taskId: 'vsl' }), event('hidden', T0)];
    expect(headsUpMeeting(events, T0 - MIN, new Set([`${T0}|hidden`]))).toBeNull();
  });

  it('skips meetings Dan declined', () => {
    expect(headsUpMeeting([event('nope', T0, { declined: true })], T0 - MIN, new Set())).toBeNull();
  });

  it('treats the same meeting in two calendars as one, so Hide hides both', () => {
    const work = event('w', T0, { title: 'Call with Kilo', calendarKey: 'work|primary' });
    const home = event('h', T0, { title: 'Call with Kilo', calendarKey: 'home|primary' });
    expect(meetingKey(work)).toBe(meetingKey(home));
    expect(headsUpMeeting([work, home], T0 - MIN, new Set([meetingKey(work)]))).toBeNull();
  });

  it('picks the meeting that starts first', () => {
    expect(headsUpMeeting([event('later', T0 + 2 * MIN), event('first', T0)], T0 - MIN, new Set())?.id).toBe('first');
  });
});

describe('declined', () => {
  it('reads Dan’s own answer from the attendees', () => {
    expect(selfDeclined({ attendees: [{ email: 'a@x.com', responseStatus: 'declined' }, { self: true, responseStatus: 'declined' }] })).toBe(true);
    expect(selfDeclined({ attendees: [{ self: true, responseStatus: 'accepted' }] })).toBe(false);
    expect(selfDeclined({})).toBe(false);
  });
});

describe('join links', () => {
  it('takes Google Meet’s own link first', () => {
    expect(joinLinkFrom({ hangoutLink: 'https://meet.google.com/abc-defg-hij', location: 'https://zoom.us/j/1' })).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('takes a video entry point from conference data', () => {
    const conferenceData = { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1' }, { entryPointType: 'video', uri: 'https://us02web.zoom.us/j/123?pwd=x' }] };
    expect(joinLinkFrom({ conferenceData })).toBe('https://us02web.zoom.us/j/123?pwd=x');
  });

  it('finds a Zoom, Teams or Meet address in the location or description', () => {
    expect(joinLinkFrom({ location: 'Zoom: https://zoom.us/j/987654 (pw 1)' })).toBe('https://zoom.us/j/987654');
    expect(joinLinkFrom({ description: '<a href="https://teams.microsoft.com/l/meetup-join/19%3a">Join</a>' })).toBe('https://teams.microsoft.com/l/meetup-join/19%3a');
  });

  it('refuses anything that is not https on a meeting host', () => {
    expect(safeJoinLink('http://zoom.us/j/1')).toBeNull();
    expect(safeJoinLink('https://zoom.us.evil.com/j/1')).toBeNull();
    expect(safeJoinLink('https://evil.com/?https://zoom.us/j/1')).toBeNull();
    expect(safeJoinLink('javascript:alert(1)')).toBeNull();
    expect(joinLinkFrom({ location: 'Office, room 4' })).toBeNull();
  });
});

describe('glance', () => {
  const running = startFocus(NO_FOCUS, { id: 'f1', todoId: 'vsl', title: 'Write VSL', minutes: 25 }, T0).state;

  it('shows nothing when nothing runs', () => {
    expect(glance(NO_FOCUS, null, T0)).toEqual({ kind: 'idle' });
  });

  it('shows the time left on a countdown and how far along it is', () => {
    expect(glance(running, null, T0 + 5 * MIN)).toMatchObject({ kind: 'focus', title: 'Write VSL', clock: '20:00', progress: 0.2, paused: false, hasTodo: true });
  });

  it('shows the time so far on a stopwatch, with no progress', () => {
    const watch = startFocus(NO_FOCUS, { id: 'f1', todoId: null, title: 'Focus', minutes: null }, T0).state;
    expect(glance(watch, null, T0 + 90_000)).toMatchObject({ kind: 'focus', clock: '1:30', progress: null, hasTodo: false });
  });

  it('shows a paused focus as paused', () => {
    expect(glance(actOnFocus(running, { kind: 'pause' }, T0 + MIN).state, null, T0 + 9 * MIN)).toMatchObject({ clock: '24:00', paused: true });
  });

  it('asks the check-in when a countdown ends', () => {
    expect(glance(tickFocus(running, T0 + 25 * MIN).state, null, T0 + 25 * MIN)).toMatchObject({ kind: 'check-in', title: 'Write VSL', hasTodo: true });
  });

  it('puts a meeting first, with the focus still running underneath', () => {
    const call = event('Call with Kilo', T0 + 10 * MIN, { joinUrl: 'https://meet.google.com/abc' });
    expect(glance(running, call, T0 + 5 * MIN + 48_000)).toMatchObject({ kind: 'meeting', title: 'Call with Kilo', clock: '4:12', joinUrl: 'https://meet.google.com/abc', focus: { clock: '19:12' } });
  });

  it('keeps a pending check-in reachable during a meeting', () => {
    const atCheckIn = tickFocus(running, T0 + 25 * MIN).state;
    expect(glance(atCheckIn, event('Call', T0 + 28 * MIN), T0 + 25 * MIN)).toMatchObject({ kind: 'meeting', checkIn: { title: 'Write VSL', hasTodo: true } });
  });

  it('says Now once the meeting has started', () => {
    expect(glance(NO_FOCUS, event('Call', T0), T0 + MIN)).toMatchObject({ kind: 'meeting', clock: 'Now', joinUrl: null, focus: null, checkIn: null });
  });
});
