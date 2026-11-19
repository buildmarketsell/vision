import ICAL from 'ical.js';
import type { CalendarEvent } from '../../../shared/calendar';

/** Repeats are walked from their first date, so a daily event from years ago takes thousands of steps; this stops a broken rule from looping for ever. */
const MAX_REPEAT_STEPS = 20_000;

function toEvent(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time): CalendarEvent {
  const startMs = start.toJSDate().getTime();
  return {
    id: `${event.uid}:${startMs}`,
    title: event.summary?.trim() || '(No title)',
    location: event.location?.trim() || null,
    allDay: start.isDate,
    start: startMs,
    end: Math.max(startMs, end.toJSDate().getTime()),
  };
}

/** Events that are still running or start between `from` and `to`, repeats expanded, soonest first. */
export function eventsBetween(icsText: string, from: number, to: number): CalendarEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(icsText));
  for (const zone of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone);

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of calendar.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

  const inRange = (event: CalendarEvent) => event.end > from && event.start < to;
  const found: CalendarEvent[] = [];
  for (const event of masters.values()) {
    if (!event.startDate) continue;
    if (!event.isRecurring()) {
      const single = toEvent(event, event.startDate, event.endDate ?? event.startDate);
      if (inRange(single)) found.push(single);
      continue;
    }
    const iterator = event.iterator();
    for (let step = 0; step < MAX_REPEAT_STEPS; step += 1) {
      const next = iterator.next();
      if (!next || next.toJSDate().getTime() >= to) break;
      const details = event.getOccurrenceDetails(next);
      const occurrence = toEvent(details.item, details.startDate, details.endDate);
      if (inRange(occurrence)) found.push({ ...occurrence, id: `${event.uid}:${next.toJSDate().getTime()}` });
    }
  }
  return found.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
}
