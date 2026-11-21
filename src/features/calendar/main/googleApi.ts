import type { CalendarEvent, CalendarInfo, GoogleEventBody } from '../../../shared/calendar';
import { GoogleError, googleEndpoints, SignInExpiredError } from './googleAuth';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGES = 5;
const FALLBACK_COLOR = '#F26B3A';

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

async function call(token: string, path: string, init: RequestInit = {}): Promise<Obj> {
  const response = await fetch(`${googleEndpoints().api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401) throw new SignInExpiredError('Google needs you to sign in again.');
  if (response.status === 403) throw new GoogleError('Google refused. Check that the Google Calendar API is turned on in your Google Cloud project.');
  // Deleting something already gone (410) is what we wanted anyway.
  if (response.status === 204 || response.status === 410) return {};
  if (!response.ok) throw new GoogleError(`Google Calendar did not answer (error ${response.status}). Try again.`);
  const body: unknown = await response.json();
  return isObj(body) ? body : {};
}

/** The account's calendars as Google lists them (calendarList.list). */
export async function listCalendars(token: string): Promise<Obj[]> {
  const body = await call(token, '/users/me/calendarList?maxResults=250');
  return Array.isArray(body['items']) ? body['items'].filter(isObj) : [];
}

/** Events between two times, repeats expanded by Google (singleEvents). `extra` narrows it (e.g. only VISION's blocks). */
export async function listEvents(token: string, calendarId: string, from: number, to: number, extra: Record<string, string> = {}): Promise<Obj[]> {
  const items: Obj[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      ...extra,
      ...(pageToken ? { pageToken } : {}),
    });
    const body = await call(token, `/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
    if (Array.isArray(body['items'])) items.push(...body['items'].filter(isObj));
    pageToken = str(body['nextPageToken']);
    if (!pageToken) break;
  }
  return items;
}

const eventsPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

export async function insertEvent(token: string, calendarId: string, body: GoogleEventBody): Promise<void> {
  await call(token, eventsPath(calendarId), { method: 'POST', body: JSON.stringify(body) });
}

export async function patchEvent(token: string, calendarId: string, eventId: string, body: Partial<GoogleEventBody>): Promise<void> {
  await call(token, `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  await call(token, `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
}

/** VISION's tags on an event, if it has them. */
export function visionTags(entry: Obj): Record<string, string> {
  const props = entry['extendedProperties'];
  const own = isObj(props) && isObj(props['private']) ? props['private'] : {};
  return Object.fromEntries(Object.entries(own).filter((pair): pair is [string, string] => pair[0].startsWith('vision') && typeof pair[1] === 'string'));
}

/** The account's email is its primary calendar's id. */
export function accountEmail(calendars: Obj[]): string | null {
  return str(calendars.find((entry) => entry['primary'] === true)?.['id']);
}

export function toCalendarInfo(account: string, entry: Obj, visibility: Record<string, boolean>): CalendarInfo | null {
  const id = str(entry['id']);
  if (!id) return null;
  const key = `${account}|${id}`;
  const role = str(entry['accessRole']);
  return {
    key,
    account,
    name: str(entry['summaryOverride']) ?? str(entry['summary']) ?? id,
    color: str(entry['backgroundColor']) ?? FALLBACK_COLOR,
    writable: role === 'owner' || role === 'writer',
    // Google leaves `selected` out for calendars it doesn't show, so only an explicit true counts.
    visible: visibility[key] ?? entry['selected'] === true,
  };
}

/** "2026-11-23" as local midnight; Google's all-day end date is the day after. */
function localDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

function timeOf(value: unknown): { ms: number; allDay: boolean } | null {
  if (!isObj(value)) return null;
  const dateTime = str(value['dateTime']);
  if (dateTime && !Number.isNaN(Date.parse(dateTime))) return { ms: Date.parse(dateTime), allDay: false };
  const date = str(value['date']);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { ms: localDay(date), allDay: true } : null;
}

export function toCalendarEvent(entry: Obj, calendar: CalendarInfo): CalendarEvent | null {
  const id = str(entry['id']);
  const start = timeOf(entry['start']);
  const end = timeOf(entry['end']);
  if (!id || !start || entry['status'] === 'cancelled') return null;
  const taskId = visionTags(entry)['visionTask'];
  return {
    ...(taskId ? { taskId } : {}),
    ...(entry['transparency'] === 'transparent' ? { free: true } : {}),
    id: `${calendar.key}|${id}`,
    calendarKey: calendar.key,
    title: str(entry['summary'])?.trim() || '(No title)',
    location: str(entry['location'])?.trim() || null,
    allDay: start.allDay,
    start: start.ms,
    end: Math.max(start.ms, end?.ms ?? start.ms),
    color: calendar.color,
  };
}
