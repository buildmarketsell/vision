/**
 * Meetings and their heads-up: the five minutes before a meeting (and its first ten, to join late), when the menu bar
 * and the island count down to it. After Black Hole's meeting countdown (getblackhole.app, MIT).
 */
import type { CalendarEvent } from './calendar';

const MINUTE_MS = 60_000;
export const HEADS_UP_BEFORE_MS = 5 * MINUTE_MS;
export const HEADS_UP_AFTER_MS = 10 * MINUTE_MS;

/** A timed event that takes time: not all-day, not marked free, not one of VISION's own blocks. */
export const isMeeting = (event: CalendarEvent) => !event.allDay && !event.free && !event.taskId;

/** The meeting in heads-up at `now` (the one that starts first), unless Dan hid it. */
export function headsUpMeeting(events: CalendarEvent[], now: number, dismissed: ReadonlySet<string>): CalendarEvent | null {
  const inHeadsUp = (event: CalendarEvent) => now >= event.start - HEADS_UP_BEFORE_MS && now < Math.min(event.start + HEADS_UP_AFTER_MS, event.end);
  return events.filter((event) => isMeeting(event) && !dismissed.has(event.id) && inHeadsUp(event)).sort((a, b) => a.start - b.start)[0] ?? null;
}

const MEETING_HOSTS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'];

/** The link if it's https on Google Meet, Zoom (any of its subdomains) or Teams; anything else is never opened. */
export function safeJoinLink(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2_000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  return MEETING_HOSTS.some((allowed) => host === allowed || (allowed === 'zoom.us' && host.endsWith('.zoom.us'))) ? url.href : null;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const LINK = /https:\/\/[^\s"'<>()]+/g;

/** The join link of a Google Calendar event: Meet's own link, a video entry in its conference data, else a meeting address in its location or description. */
export function joinLinkFrom(entry: Obj): string | null {
  const own = safeJoinLink(entry['hangoutLink']);
  if (own) return own;
  const points = isObj(entry['conferenceData']) && Array.isArray(entry['conferenceData']['entryPoints']) ? entry['conferenceData']['entryPoints'] : [];
  for (const point of points) {
    const link = isObj(point) && point['entryPointType'] === 'video' ? safeJoinLink(point['uri']) : null;
    if (link) return link;
  }
  for (const field of ['location', 'description']) {
    const text = entry[field];
    for (const match of typeof text === 'string' ? text.matchAll(LINK) : []) {
      const link = safeJoinLink(match[0].replace(/[.,;:!?]+$/, ''));
      if (link) return link;
    }
  }
  return null;
}
