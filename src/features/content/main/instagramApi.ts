import type { AccountStats, PeriodStats, PostStat } from '../../../shared/content';
import { contentEndpoints, ContentError, getJson, isObj, list, num, str, type Obj } from './http';

const RECENT_POSTS = 12;
const DAY_MS = 24 * 60 * 60_000;

/** Instagram drops the connection: Dan has to paste a new token. */
export class InstagramTokenError extends ContentError {}

function explain(status: number, body: Obj): Error {
  const error = isObj(body['error']) ? body['error'] : {};
  // Code 190 is Instagram's "token expired or revoked".
  if (status === 401 || num(error['code']) === 190) return new InstagramTokenError('Instagram no longer accepts the token. Paste a new one to connect again.');
  const said = str(error['message']);
  return new ContentError(said ? `Instagram refused: ${said}` : `Instagram did not answer (error ${status}). Try again.`);
}

async function call(token: string, path: string, query: Record<string, string> = {}): Promise<Obj> {
  return getJson(`${contentEndpoints().instagram}${path}?${new URLSearchParams({ ...query, access_token: token })}`, explain);
}

/** One post from /me/media. */
export function toInstagramPost(entry: Obj): PostStat | null {
  const id = str(entry['id']);
  const published = Date.parse(str(entry['timestamp']) ?? '');
  if (!id || Number.isNaN(published)) return null;
  const caption = str(entry['caption'])?.split('\n')[0]?.trim();
  const isVideo = entry['media_type'] === 'VIDEO';
  return {
    id,
    title: caption || '(No caption)',
    url: str(entry['permalink']) ?? 'https://www.instagram.com/',
    thumbnail: (isVideo ? str(entry['thumbnail_url']) : null) ?? str(entry['media_url']) ?? str(entry['thumbnail_url']),
    publishedAt: published,
    views: null,
    likes: num(entry['like_count']),
    comments: num(entry['comments_count']),
  };
}

/** The account's 28-day totals from /me/insights (metric_type=total_value). */
export function toInstagramPeriod(reply: Obj): PeriodStats {
  const values = new Map(list(reply['data']).map((item) => [str(item['name']), isObj(item['total_value']) ? num(item['total_value']['value']) : null]));
  return {
    views: values.get('views') ?? null,
    reach: values.get('reach') ?? null,
    profileViews: values.get('profile_views') ?? null,
    interactions: values.get('total_interactions') ?? null,
  };
}

export function toInstagramAccount(me: Obj): AccountStats | null {
  const username = str(me['username']);
  if (!username) return null;
  return {
    name: str(me['name']) ?? username,
    handle: `@${username}`,
    url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    avatar: str(me['profile_picture_url']),
    followers: num(me['followers_count']) ?? 0,
    totalViews: null,
    posts: num(me['media_count']) ?? 0,
    last28Days: null,
    recent: [],
  };
}

/** Profile, latest posts and (if the token allows) 28-day insights. Insights failing never hides the rest. */
export async function fetchInstagram(token: string): Promise<AccountStats> {
  const me = await call(token, '/me', { fields: 'username,name,profile_picture_url,followers_count,media_count' });
  const account = toInstagramAccount(me);
  if (!account) throw new ContentError('Instagram did not say which account this is. Is it a Business or Creator account?');
  const until = Math.floor(Date.now() / 1000);
  const [media, insights] = await Promise.allSettled([
    call(token, '/me/media', { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', limit: String(RECENT_POSTS) }),
    call(token, '/me/insights', {
      metric: 'views,reach,profile_views,total_interactions',
      period: 'day',
      metric_type: 'total_value',
      since: String(until - 28 * DAY_MS / 1000),
      until: String(until),
    }),
  ]);
  if (media.status === 'rejected' && media.reason instanceof InstagramTokenError) throw media.reason;
  return {
    ...account,
    recent: media.status === 'fulfilled' ? list(media.value['data']).flatMap((entry) => toInstagramPost(entry) ?? []) : [],
    last28Days: insights.status === 'fulfilled' ? toInstagramPeriod(insights.value) : null,
  };
}

/** Swaps a long-lived token for a fresh 60-day one; null if Instagram says no (the old one keeps working until it expires). */
export async function refreshInstagramToken(token: string): Promise<string | null> {
  try {
    const reply = await call(token, '/refresh_access_token', { grant_type: 'ig_refresh_token' });
    return str(reply['access_token']);
  } catch {
    return null;
  }
}
