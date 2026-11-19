import { app, ipcMain } from 'electron';
import { readFileSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CALENDAR_DAYS_AHEAD, cleanCalendarUrl, isCalendarUrl, type CalendarState } from '../../../shared/calendar';
import { IPC } from '../../../shared/ipc';
import { logError } from '../../../main/log';
import { eventsBetween } from './ics';

const DAY_MS = 24 * 60 * 60_000;
/** Fetched again at most this often; the view also asks every few minutes. */
const CACHE_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ICS_BYTES = 10 * 1024 * 1024;

/** The private link stays in the main process: it is a password to the calendar, so it never goes to the page or the logs. */
let calendarUrl: string | null | undefined;
let cache: { state: CalendarState; at: number } | null = null;

function settingsPath(): string {
  return join(app.getPath('userData'), 'calendar.json');
}

function savedUrl(): string | null {
  if (calendarUrl !== undefined) return calendarUrl;
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsPath(), 'utf8'));
    const url = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['url'] : null;
    calendarUrl = isCalendarUrl(url) ? url : null;
  } catch {
    calendarUrl = null;
  }
  return calendarUrl;
}

/** A problem Dan can act on; its message is shown as is. */
class CalendarError extends Error {}

async function download(url: string): Promise<string> {
  // End-to-end tests read a fixture file instead of the internet (like VISION_CLAUDE_COMMAND fakes Claude).
  const fixture = process.env['VISION_CALENDAR_FIXTURE'];
  if (fixture) return readFile(fixture, 'utf8');
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
  if (!response.ok) {
    throw new CalendarError(response.status === 404 ? 'Google did not find that calendar. Copy the secret address again.' : `The calendar did not load (error ${response.status}).`);
  }
  const text = await response.text();
  if (text.length > MAX_ICS_BYTES) throw new CalendarError('That calendar is too big to show.');
  if (!text.includes('BEGIN:VCALENDAR')) throw new CalendarError('That link is not a calendar. Use the "Secret address in iCal format".');
  return text;
}

async function readCalendar(url: string): Promise<CalendarState> {
  try {
    const now = Date.now();
    const events = eventsBetween(await download(url), now - DAY_MS, now + CALENDAR_DAYS_AHEAD * DAY_MS);
    return { kind: 'ready', events, fetchedAt: now };
  } catch (error) {
    if (error instanceof CalendarError) return { kind: 'error', message: error.message };
    if (error instanceof Error && error.name === 'TimeoutError') return { kind: 'error', message: 'The calendar took too long to answer. Check your internet.' };
    logError('Calendar read failed', error);
    const message = 'The calendar could not be read. Check your internet, or copy the link again.';
    return { kind: 'error', message };
  }
}

async function upcoming(force: boolean): Promise<CalendarState> {
  const url = savedUrl();
  if (!url) return { kind: 'notConnected' };
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  const state = await readCalendar(url);
  cache = { state, at: Date.now() };
  return state;
}

export function registerCalendar(): void {
  ipcMain.handle(IPC.calendarUpcoming, (_event, force: unknown) => upcoming(force === true));

  /** Checks the link works before saving it, so a wrong link shows an error instead of an empty calendar. */
  ipcMain.handle(IPC.calendarConnect, async (_event, value: unknown): Promise<CalendarState> => {
    if (typeof value !== 'string' || !isCalendarUrl(cleanCalendarUrl(value))) {
      return { kind: 'error', message: 'Paste the full link, starting with https://' };
    }
    const url = cleanCalendarUrl(value);
    const state = await readCalendar(url);
    if (state.kind !== 'ready') return state;
    try {
      await writeFile(`${settingsPath()}.tmp`, JSON.stringify({ url }), { encoding: 'utf8', mode: 0o600 });
      await rename(`${settingsPath()}.tmp`, settingsPath());
    } catch (error) {
      logError('Could not save the calendar link', error);
      return { kind: 'error', message: 'The calendar loaded but the link could not be saved. Try again.' };
    }
    calendarUrl = url;
    cache = { state, at: Date.now() };
    return state;
  });

  ipcMain.handle(IPC.calendarDisconnect, async (): Promise<CalendarState> => {
    calendarUrl = null;
    cache = null;
    await rm(settingsPath(), { force: true }).catch((error: unknown) => logError('Could not remove the calendar link', error));
    return { kind: 'notConnected' };
  });
}
