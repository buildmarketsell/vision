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

const DAY_MINUTES = 24 * 60;
/** Dragging snaps to quarter hours, like Google Calendar. */
export const DRAG_SNAP_MINUTES = 15;
/** A click (no drag) makes an hour from the half hour clicked. */
const CLICK_SNAP_MINUTES = 30;

/** Minutes from midnight at `offsetPx` down a day column `hourPx` tall per hour, rounded down to `snap`, kept inside the day. */
export function minutesAt(offsetPx: number, hourPx: number, snap: number): number {
  const minutes = Math.floor(((offsetPx / hourPx) * 60) / snap) * snap;
  return Math.min(DAY_MINUTES - snap, Math.max(0, minutes));
}

/**
 * The time range between where the drag started and where the pointer is now, in either direction.
 * Each end covers its whole quarter hour, so a drag from 16:00 to 16:20 selects 16:00–16:30.
 */
export function dragRange(fromMinutes: number, toMinutes: number): { start: number; end: number } {
  const start = Math.min(fromMinutes, toMinutes);
  const end = Math.min(DAY_MINUTES, Math.max(fromMinutes, toMinutes) + DRAG_SNAP_MINUTES);
  return { start, end };
}

/** A plain click: an hour starting at the half hour under the pointer (ends at midnight at the latest). */
export function clickRange(offsetPx: number, hourPx: number): { start: number; end: number } {
  const start = minutesAt(offsetPx, hourPx, CLICK_SNAP_MINUTES);
  return { start, end: Math.min(DAY_MINUTES, start + 60) };
}

/** "16:00" for minutes from midnight; 1440 (end of the day) reads "23:59" so it stays a valid time. */
export function clockTime(minutes: number): string {
  const clamped = Math.min(minutes, DAY_MINUTES - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}
