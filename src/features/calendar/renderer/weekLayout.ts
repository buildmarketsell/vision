import type { CalendarEvent } from '../../../shared/calendar';

export const DAYS_IN_WEEK = 7;
const MINUTE_MS = 60_000;
/** Short events still get room for their name. */
const MIN_BLOCK_MINUTES = 20;

/** Local midnight of the day `ms` falls on. */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Midnight `days` days later; by calendar date, so a daylight-saving change never shifts it by an hour. */
export function addDays(dayStart: number, days: number): number {
  const date = new Date(dayStart);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** Monday of the week `ms` falls in, like Notion Calendar's default. */
export function startOfWeek(ms: number): number {
  const day = startOfDay(ms);
  const weekday = (new Date(day).getDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function weekDays(weekStart: number): number[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));
}

export interface PlacedEvent {
  event: CalendarEvent;
  /** Minutes from midnight. */
  top: number;
  height: number;
  /** Side-by-side slot for overlapping events: this one's, out of `columns`. */
  column: number;
  columns: number;
}

/** Timed events on one day, cut to that day, with overlapping ones sharing the width. */
export function layoutDay(events: CalendarEvent[], dayStart: number): PlacedEvent[] {
  const dayEnd = addDays(dayStart, 1);
  const pieces = events
    .filter((event) => !event.allDay && event.start < dayEnd && event.end > dayStart)
    .map((event) => {
      const top = (Math.max(event.start, dayStart) - dayStart) / MINUTE_MS;
      const bottom = (Math.min(event.end, dayEnd) - dayStart) / MINUTE_MS;
      return { event, top, height: Math.max(MIN_BLOCK_MINUTES, bottom - top), column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  // Events that overlap, directly or through each other, form a cluster; each takes the first free column.
  let cluster: PlacedEvent[] = [];
  let clusterEnd = -1;
  const finish = () => {
    const columns = Math.max(1, ...cluster.map((piece) => piece.column + 1));
    for (const piece of cluster) piece.columns = columns;
    cluster = [];
  };
  for (const piece of pieces) {
    if (piece.top >= clusterEnd) finish();
    const taken = new Set(cluster.filter((other) => other.top + other.height > piece.top).map((other) => other.column));
    let column = 0;
    while (taken.has(column)) column += 1;
    piece.column = column;
    cluster.push(piece);
    clusterEnd = Math.max(clusterEnd, piece.top + piece.height);
  }
  finish();
  return pieces;
}

/** All-day events (and ones spanning whole days) shown on a day, in the row above the hours. */
export function allDayOn(events: CalendarEvent[], dayStart: number): CalendarEvent[] {
  const dayEnd = addDays(dayStart, 1);
  return events.filter((event) => event.allDay && event.start < dayEnd && event.end > dayStart);
}

/** "November 2026", or "Nov – Dec 2026" when the week spans two months. */
export function weekTitle(weekStart: number): string {
  const first = new Date(weekStart);
  const last = new Date(addDays(weekStart, DAYS_IN_WEEK - 1));
  if (first.getMonth() === last.getMonth()) return first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const month = (date: Date) => date.toLocaleDateString(undefined, { month: 'short' });
  return `${month(first)} – ${month(last)} ${last.getFullYear()}`;
}
