/** Calendar: upcoming events read from a private iCal link (Google Calendar's "secret address"). Read-only. */

export interface CalendarEvent {
  /** Unique per occurrence (a weekly meeting has one per week). */
  id: string;
  title: string;
  location: string | null;
  allDay: boolean;
  /** Milliseconds since 1970. All-day events start at local midnight. */
  start: number;
  end: number;
}

export type CalendarState =
  | { kind: 'notConnected' }
  | { kind: 'ready'; events: CalendarEvent[]; fetchedAt: number }
  | { kind: 'error'; message: string };

/** How far ahead the calendar looks. */
export const CALENDAR_DAYS_AHEAD = 14;

/** Only https links: the link is a password, never send it in the clear. */
export function isCalendarUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_000) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Google shows the link as webcal:// in some places; it is the same address over https. */
export function cleanCalendarUrl(value: string): string {
  return value.trim().replace(/^webcal:\/\//i, 'https://');
}
