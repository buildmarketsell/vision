import type { CalendarEvent } from '../../../shared/calendar';

export interface AgendaDay {
  key: string;
  /** "Today", "Tomorrow" or "Monday". */
  label: string;
  /** "Thu 19 Nov". */
  date: string;
  events: CalendarEvent[];
}

const DAY_MS = 24 * 60 * 60_000;
const SOON_MS = 3 * 60 * 60_000;

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayLabel(dayStart: number, today: number): string {
  const days = Math.round((dayStart - today) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return new Date(dayStart).toLocaleDateString(undefined, { weekday: 'long' });
}

/** Events that haven't ended, by day. Something that began before today but is still on shows under Today. */
export function groupAgenda(events: CalendarEvent[], now: number): AgendaDay[] {
  const today = startOfDay(now);
  const days = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    if (event.end <= now && !(event.allDay && event.end > today)) continue;
    const day = Math.max(startOfDay(event.start), today);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, dayEvents]) => ({
      key: String(day),
      label: dayLabel(day, today),
      date: new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      events: dayEvents,
    }));
}

export function timeRange(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return event.end > event.start ? `${time(event.start)} – ${time(event.end)}` : time(event.start);
}

/** "Now" or "in 25 min" for what is on or coming up within a few hours, else null. */
export function soonLabel(event: CalendarEvent, now: number): string | null {
  if (event.allDay) return null;
  if (event.start <= now && event.end > now) return 'Now';
  const left = event.start - now;
  if (left <= 0 || left > SOON_MS) return null;
  const minutes = Math.round(left / 60_000);
  return minutes < 60 ? `in ${minutes} min` : `in ${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
}
