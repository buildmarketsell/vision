import { ipcMain } from 'electron';
import { CALENDAR_DAYS_AHEAD, toGoogleEvent, toNewEventInput, type CalendarAccount, type CalendarEvent, type CalendarInfo, type CalendarState } from '../../../shared/calendar';
import { IPC, type Result } from '../../../shared/ipc';
import { logError } from '../../../main/log';
import { KeychainUnavailableError } from '../../../main/secrets';
import { loadConfig, saveConfig } from './calendarConfig';
import { accessToken, cancelSignIn, forgetAccessToken, GoogleError, signIn, SignInExpiredError } from './googleAuth';
import { accountEmail, insertEvent, listCalendars, listEvents, toCalendarEvent, toCalendarInfo } from './googleApi';

const DAY_MS = 24 * 60 * 60_000;
/** Fetched again at most this often; the view also asks every few minutes. */
const CACHE_MS = 3 * 60_000;

interface Fetched {
  accounts: CalendarAccount[];
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  error?: string;
  at: number;
}

let cache: Fetched | null = null;

/** The message to show Dan; anything unexpected is logged (without tokens) and gets a general message. */
function messageFor(error: unknown): string {
  if (error instanceof GoogleError || error instanceof SignInExpiredError || error instanceof KeychainUnavailableError) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return 'Google took too long to answer. Check your internet.';
  logError('Calendar request failed', error instanceof Error ? error.message : 'unknown');
  return 'The calendar could not be read. Check your internet and try again.';
}

async function fetchAccount(account: { email: string; refreshToken: string }, from: number, to: number) {
  const { client, visibility } = loadConfig();
  if (!client) throw new GoogleError('Set up the Google client first.');
  const token = await accessToken(client, account.refreshToken);
  const calendars = (await listCalendars(token)).flatMap((entry) => toCalendarInfo(account.email, entry, visibility) ?? []);
  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const id = calendar.key.slice(account.email.length + 1);
      return (await listEvents(token, id, from, to)).flatMap((entry) => toCalendarEvent(entry, calendar) ?? []);
    }),
  );
  return { calendars, events: perCalendar.flat() };
}

async function fetchAll(from: number, to: number): Promise<Fetched> {
  const now = Date.now();
  const results = await Promise.allSettled(loadConfig().accounts.map((account) => fetchAccount(account, from, to)));
  const fetched: Fetched = { accounts: [], calendars: [], events: [], at: now };
  results.forEach((result, index) => {
    const email = loadConfig().accounts[index]?.email ?? '';
    const expired = result.status === 'rejected' && result.reason instanceof SignInExpiredError;
    fetched.accounts.push({ email, needsSignIn: expired });
    if (result.status === 'fulfilled') {
      fetched.calendars.push(...result.value.calendars);
      fetched.events.push(...result.value.events);
    } else if (!expired) fetched.error = messageFor(result.reason);
  });
  fetched.events.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
  return fetched;
}

/** Only the calendars Dan chose to see contribute events (his latest choice wins over what was cached). */
function toState(fetched: Fetched): CalendarState {
  const { visibility } = loadConfig();
  const calendars = fetched.calendars.map((calendar) => ({ ...calendar, visible: visibility[calendar.key] ?? calendar.visible }));
  const visible = new Set(calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.key));
  return {
    kind: 'ready',
    accounts: fetched.accounts,
    calendars,
    events: fetched.events.filter((event) => visible.has(event.calendarKey)),
    fetchedAt: fetched.at,
    ...(fetched.error ? { error: fetched.error } : {}),
  };
}

async function currentState(force: boolean, setupError?: string): Promise<CalendarState> {
  const { client, accounts } = loadConfig();
  if (!client || accounts.length === 0) return { kind: 'setup', hasClient: client !== null, ...(setupError ? { error: setupError } : {}) };
  if (force || !cache || Date.now() - cache.at > CACHE_MS) cache = await fetchAll(Date.now() - DAY_MS, Date.now() + CALENDAR_DAYS_AHEAD * DAY_MS);
  return toState(cache);
}

/** The calendar page asks for one week at a time; recent weeks are kept a few minutes so paging back and forth is instant. */
const MAX_RANGE_MS = 62 * DAY_MS;
const rangeCache = new Map<string, Fetched>();

async function rangeState(from: unknown, to: unknown, force: boolean): Promise<CalendarState> {
  if (typeof from !== 'number' || typeof to !== 'number' || !Number.isFinite(from) || to <= from || to - from > MAX_RANGE_MS) {
    return currentState(false);
  }
  const { client, accounts } = loadConfig();
  if (!client || accounts.length === 0) return { kind: 'setup', hasClient: client !== null };
  const key = `${from}-${to}`;
  const cached = rangeCache.get(key);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return toState(cached);
  const fetched = await fetchAll(from, to);
  if (rangeCache.size > 20) rangeCache.clear();
  rangeCache.set(key, fetched);
  return toState(fetched);
}

const asText = (value: unknown, max = 500) => (typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null);

export function registerCalendar(): void {
  ipcMain.handle(IPC.calendarState, (_event, force: unknown) => currentState(force === true));
  ipcMain.handle(IPC.calendarRange, (_event, from: unknown, to: unknown, force: unknown) => rangeState(from, to, force === true));

  ipcMain.handle(IPC.calendarSetClient, async (_event, id: unknown, secret: unknown) => {
    const clientId = asText(id);
    const clientSecret = asText(secret);
    if (!clientId?.endsWith('.apps.googleusercontent.com') || !clientSecret) {
      return currentState(false, 'Paste the Client ID (it ends in .apps.googleusercontent.com) and the Client secret.');
    }
    try {
      await saveConfig({ ...loadConfig(), client: { id: clientId, secret: clientSecret } });
    } catch (error) {
      return currentState(false, messageFor(error));
    }
    return currentState(false);
  });

  /** Signs in an account (new, or again after Google dropped it) and remembers it. */
  ipcMain.handle(IPC.calendarSignIn, async () => {
    const config = loadConfig();
    if (!config.client) return currentState(false, 'Set up the Google client first.');
    try {
      const refreshToken = await signIn(config.client);
      const email = accountEmail(await listCalendars(await accessToken(config.client, refreshToken)));
      if (!email) throw new GoogleError('Google did not say which account this is. Try again.');
      const others = config.accounts.filter((account) => account.email !== email);
      await saveConfig({ ...config, accounts: [...others, { email, refreshToken }] });
      rangeCache.clear();
      return currentState(true);
    } catch (error) {
      const message = messageFor(error);
      return config.accounts.length > 0 ? { ...(await currentState(true)), error: message } : currentState(false, message);
    }
  });

  ipcMain.on(IPC.calendarCancelSignIn, () => cancelSignIn());

  ipcMain.handle(IPC.calendarSignOut, async (_event, email: unknown) => {
    const config = loadConfig();
    const leaving = config.accounts.find((account) => account.email === email);
    if (leaving) forgetAccessToken(leaving.refreshToken);
    rangeCache.clear();
    await saveConfig({ ...config, accounts: config.accounts.filter((account) => account !== leaving) }).catch((error: unknown) => logError('Could not save calendar settings', error));
    return currentState(true);
  });

  ipcMain.handle(IPC.calendarSetVisible, async (_event, key: unknown, visible: unknown) => {
    if (typeof key !== 'string' || typeof visible !== 'boolean') return currentState(false);
    const config = loadConfig();
    await saveConfig({ ...config, visibility: { ...config.visibility, [key]: visible } }).catch((error: unknown) => logError('Could not save calendar settings', error));
    if (cache) cache = { ...cache, calendars: cache.calendars.map((calendar) => (calendar.key === key ? { ...calendar, visible } : calendar)) };
    return currentState(false);
  });

  ipcMain.handle(IPC.calendarCreateEvent, async (_event, input: unknown): Promise<Result<CalendarState>> => {
    const form = toNewEventInput(input);
    if (!form) return { ok: false, error: 'Fill in the event again.' };
    const config = loadConfig();
    const calendar = [cache, ...rangeCache.values()].flatMap((fetched) => fetched?.calendars ?? []).find((item) => item.key === form.calendarKey);
    const account = config.accounts.find((item) => item.email === calendar?.account);
    if (!config.client || !calendar || !account || !calendar.writable) return { ok: false, error: 'Pick a calendar you can add events to.' };
    const built = toGoogleEvent(form, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if ('error' in built) return { ok: false, error: built.error };
    try {
      await insertEvent(await accessToken(config.client, account.refreshToken), calendar.key.slice(account.email.length + 1), built.body);
      rangeCache.clear();
      return { ok: true, value: await currentState(true) };
    } catch (error) {
      return { ok: false, error: messageFor(error) };
    }
  });
}
