/** Calendar: Dan's Google calendars (one or more accounts), read and written through Google's Calendar API. */

export interface CalendarInfo {
  /** `<account email>|<Google calendar id>`, unique across accounts. */
  key: string;
  account: string;
  name: string;
  /** Google's color for it, e.g. "#7986cb". */
  color: string;
  /** Dan can add events to it (owner or writer). */
  writable: boolean;
  visible: boolean;
}

export interface CalendarEvent {
  /** Unique per occurrence (a weekly meeting has one per week). */
  id: string;
  calendarKey: string;
  title: string;
  location: string | null;
  allDay: boolean;
  /** Milliseconds since 1970. All-day events start at local midnight. */
  start: number;
  end: number;
  color: string;
}

export interface CalendarAccount {
  email: string;
  /** Google stopped accepting the saved sign-in (revoked, expired): sign in again. */
  needsSignIn: boolean;
}

export type CalendarState =
  /** Step 1: the Google client (Client ID and secret) isn't set up yet. Step 2: no account signed in. */
  | { kind: 'setup'; hasClient: boolean; error?: string }
  | { kind: 'ready'; accounts: CalendarAccount[]; calendars: CalendarInfo[]; events: CalendarEvent[]; fetchedAt: number; error?: string };

/** What the new-event form sends. Dates and times are local, as typed. */
export interface NewEventInput {
  calendarKey: string;
  title: string;
  location: string;
  /** YYYY-MM-DD */
  date: string;
  allDay: boolean;
  /** HH:MM, ignored for all-day events. */
  startTime: string;
  endTime: string;
}

/** The body Google's events.insert expects. */
export interface GoogleEventBody {
  summary: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
}

/** How far ahead the calendar looks. */
export const CALENDAR_DAYS_AHEAD = 14;
export const MAX_EVENT_TITLE = 500;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function nextDay(date: string): string {
  const [, y, m, d] = DATE.exec(date) ?? [];
  const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
  return next.toISOString().slice(0, 10);
}

/** Checks the form and builds Google's body, or says what to fix. */
export function toGoogleEvent(input: NewEventInput, timeZone: string): { body: GoogleEventBody } | { error: string } {
  const title = input.title.trim();
  if (!title) return { error: 'Give the event a name.' };
  if (title.length > MAX_EVENT_TITLE) return { error: 'That name is too long.' };
  if (!DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) return { error: 'Pick a date.' };
  const location = input.location.trim().slice(0, MAX_EVENT_TITLE);
  const base = { summary: title, ...(location ? { location } : {}) };
  if (input.allDay) return { body: { ...base, start: { date: input.date }, end: { date: nextDay(input.date) } } };
  if (!TIME.test(input.startTime) || !TIME.test(input.endTime)) return { error: 'Pick a start and an end time.' };
  if (input.endTime <= input.startTime) return { error: 'The end must be after the start.' };
  return {
    body: {
      ...base,
      start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone },
      end: { dateTime: `${input.date}T${input.endTime}:00`, timeZone },
    },
  };
}

/** The form's fields if they are all text (anything else from the page is refused). */
export function toNewEventInput(raw: unknown): NewEventInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : null);
  const fields = { calendarKey: text('calendarKey'), title: text('title'), location: text('location') ?? '', date: text('date'), startTime: text('startTime') ?? '', endTime: text('endTime') ?? '' };
  if (fields.calendarKey === null || fields.title === null || fields.date === null || typeof value['allDay'] !== 'boolean') return null;
  return { ...fields, calendarKey: fields.calendarKey, title: fields.title, date: fields.date, allDay: value['allDay'] };
}
