/**
 * Free time for the auto-scheduler: working hours minus what's already on the calendar, on a 15-minute grid.
 * Adapted from Tactus (github.com/kevin-y-yu/tactus, MIT, Copyright (c) 2026 Kevin Yu), lib/scheduler.js.
 * Times are the Mac's local time: a day's hours are built with `new Date(y, m, d, h, min)`, so daylight saving never shifts them.
 */
import { minutesOf, type WeekHours } from './plan';

export const MINUTE_MS = 60_000;
export const GRID_MS = 15 * MINUTE_MS;

export interface Span {
  start: number;
  end: number;
}

export const ceilGrid = (ms: number) => Math.ceil(ms / GRID_MS) * GRID_MS;
export const floorGrid = (ms: number) => Math.floor(ms / GRID_MS) * GRID_MS;
const byStart = (a: Span, b: Span) => a.start - b.start || a.end - b.end;

/** The working hours of `days` days starting today, cut to start no earlier than `from`. */
export function hoursWindows(week: WeekHours, from: number, days: number): Span[] {
  const today = new Date(from);
  const out: Span[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const range = week[date.getDay()];
    if (!range) continue;
    const at = (minutes: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime();
    const start = Math.max(from, at(minutesOf(range.from)));
    const end = at(minutesOf(range.to));
    if (end > start) out.push({ start, end });
  }
  return out;
}

/** Each span minus every cut, sorted, empty pieces dropped. */
export function subtract(spans: Span[], cuts: Span[]): Span[] {
  const sortedCuts = [...cuts].sort(byStart);
  const out: Span[] = [];
  for (const span of [...spans].sort(byStart)) {
    let cursor = span.start;
    for (const cut of sortedCuts) {
      if (cut.start >= span.end) break;
      if (cut.end <= cursor) continue;
      if (cut.start > cursor) out.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
      if (cursor >= span.end) break;
    }
    if (cursor < span.end) out.push({ start: cursor, end: span.end });
  }
  return out;
}

/** Shrinks each span to whole quarter hours; drops any shorter than one. */
export function alignInward(spans: Span[]): Span[] {
  return spans.flatMap((span) => {
    const start = ceilGrid(span.start);
    const end = floorGrid(span.end);
    return end - start >= GRID_MS ? [{ start, end }] : [];
  });
}

/** Joins spans that overlap (touching ones stay separate). */
export function mergeOverlapping(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of [...spans].sort(byStart)) {
    const last = out[out.length - 1];
    if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
    else out.push({ ...span });
  }
  return out;
}

/** The span of sorted `spans` that contains `at`, or null. */
export function spanAt(spans: Span[], at: number): Span | null {
  for (const span of spans) {
    if (span.start > at) break;
    if (at < span.end) return span;
  }
  return null;
}
