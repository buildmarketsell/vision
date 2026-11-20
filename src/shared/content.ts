/** The Content dashboard: YouTube and Instagram numbers, shared by main and the page. */

export type Platform = 'youtube' | 'instagram';
export const PLATFORMS: Platform[] = ['youtube', 'instagram'];

export const isPlatform = (value: unknown): value is Platform => value === 'youtube' || value === 'instagram';

/** One video or post. Null where the platform doesn't give that number. */
export interface PostStat {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  publishedAt: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

/** Numbers for the last 28 days the platform reports itself (Instagram only, for now). */
export interface PeriodStats {
  views: number | null;
  reach: number | null;
  profileViews: number | null;
  interactions: number | null;
}

export interface AccountStats {
  name: string;
  handle: string;
  url: string;
  avatar: string | null;
  followers: number;
  /** Lifetime views (YouTube); Instagram has none. */
  totalViews: number | null;
  posts: number;
  last28Days: PeriodStats | null;
  recent: PostStat[];
}

/** One reading a day, kept on this Mac, so growth shows even where the platform gives no history. */
export interface Snapshot {
  day: string;
  followers: number;
  totalViews: number | null;
}

export type PlatformState =
  | { connected: false; error?: string }
  | { connected: true; stats: AccountStats | null; history: Snapshot[]; error?: string };

export interface ContentState {
  youtube: PlatformState;
  instagram: PlatformState;
  fetchedAt: number;
}

/** Up to about 13 months of daily readings per platform. */
export const MAX_SNAPSHOTS = 400;

/** "2026-11-20" in the Mac's own time zone. */
export function dayKey(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Adds today's reading, replacing an earlier one from the same day; oldest first. */
export function addSnapshot(history: Snapshot[], snapshot: Snapshot): Snapshot[] {
  return [...history.filter((item) => item.day !== snapshot.day), snapshot].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_SNAPSHOTS);
}

/**
 * How much a number grew over the last `days`, from the oldest reading in that window.
 * Null until there are two readings, so a fresh connection never shows a fake "+0".
 */
export function growth(history: Snapshot[], days: number, pick: (snapshot: Snapshot) => number | null, now = Date.now()): number | null {
  const from = dayKey(now - days * 24 * 60 * 60_000);
  const window = history.filter((item) => item.day >= from && pick(item) !== null);
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last || first === last) return null;
  return (pick(last) ?? 0) - (pick(first) ?? 0);
}

/**
 * What Dan typed for his channel: `@handle`, a channel link or a `UC…` id.
 * Returns the YouTube API parameter to look it up by, or null if it can't be one.
 */
export function parseChannel(input: string): { forHandle: string } | { id: string } | null {
  const text = input.trim();
  const id = /(?:^|\/channel\/)(UC[\w-]{22})(?:[/?#]|$)/.exec(text)?.[1];
  if (id) return { id };
  const handle = /(?:^|youtube\.com\/)@([\w.-]{3,30})(?:[/?#]|$)/.exec(text)?.[1] ?? /^([\w.-]{3,30})$/.exec(text)?.[1];
  return handle ? { forHandle: `@${handle}` } : null;
}

export const platformName: Record<Platform, string> = { youtube: 'YouTube', instagram: 'Instagram' };
