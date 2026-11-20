import type { AccountStats, PostStat } from '../../../shared/content';
import { contentEndpoints, ContentError, getJson, isObj, list, num, str, type Obj } from './http';

const RECENT_VIDEOS = 12;

function message(status: number, body: Obj): string {
  const reason = str(list(isObj(body['error']) ? body['error']['errors'] : [])[0]?.['reason']);
  if (reason === 'quotaExceeded') return 'YouTube’s daily free limit is used up. The numbers come back tomorrow.';
  if (status === 400 || reason === 'keyInvalid') return 'YouTube did not accept the API key. Check it and connect again.';
  if (status === 403) return 'YouTube refused. Check that the YouTube Data API v3 is turned on in your Google Cloud project.';
  return `YouTube did not answer (error ${status}). Try again.`;
}

const explain = (status: number, body: Obj) => new ContentError(message(status, body));

async function call(key: string, path: string, query: Record<string, string>): Promise<Obj> {
  return getJson(`${contentEndpoints().youtube}${path}?${new URLSearchParams({ ...query, key })}`, explain);
}

const bestThumbnail = (snippet: Obj): string | null => {
  const thumbnails = isObj(snippet['thumbnails']) ? snippet['thumbnails'] : {};
  for (const size of ['medium', 'high', 'default']) {
    const url = isObj(thumbnails[size]) ? str(thumbnails[size]['url']) : null;
    if (url) return url;
  }
  return null;
};

/** One video from videos.list (snippet + statistics). */
export function toYouTubeVideo(entry: Obj): PostStat | null {
  const id = str(entry['id']);
  const snippet = isObj(entry['snippet']) ? entry['snippet'] : {};
  const stats = isObj(entry['statistics']) ? entry['statistics'] : {};
  const published = Date.parse(str(snippet['publishedAt']) ?? '');
  if (!id || Number.isNaN(published)) return null;
  return {
    id,
    title: str(snippet['title']) ?? '(No title)',
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    thumbnail: bestThumbnail(snippet),
    publishedAt: published,
    views: num(stats['viewCount']),
    likes: num(stats['likeCount']),
    comments: num(stats['commentCount']),
  };
}

/** The channel from channels.list (snippet, statistics, contentDetails), without its videos. */
export function toYouTubeChannel(entry: Obj): { stats: AccountStats; uploads: string | null } | null {
  const id = str(entry['id']);
  const snippet = isObj(entry['snippet']) ? entry['snippet'] : {};
  const stats = isObj(entry['statistics']) ? entry['statistics'] : {};
  const related = isObj(entry['contentDetails']) && isObj(entry['contentDetails']['relatedPlaylists']) ? entry['contentDetails']['relatedPlaylists'] : {};
  if (!id) return null;
  const handle = str(snippet['customUrl']) ?? id;
  return {
    stats: {
      name: str(snippet['title']) ?? handle,
      handle,
      url: handle.startsWith('@') ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${id}`,
      avatar: bestThumbnail(snippet),
      followers: num(stats['subscriberCount']) ?? 0,
      totalViews: num(stats['viewCount']),
      posts: num(stats['videoCount']) ?? 0,
      last28Days: null,
      recent: [],
    },
    uploads: str(related['uploads']),
  };
}

/** The channel's public numbers and its latest videos. `channel` is what parseChannel returned. */
export async function fetchYouTube(key: string, channel: { forHandle: string } | { id: string }): Promise<AccountStats> {
  const reply = await call(key, '/channels', { part: 'snippet,statistics,contentDetails', ...channel });
  const found = toYouTubeChannel(list(reply['items'])[0] ?? {});
  if (!found) throw new ContentError('YouTube found no channel with that name. Check the handle, e.g. @yourchannel.');
  if (!found.uploads) return found.stats;
  const playlist = await call(key, '/playlistItems', { part: 'contentDetails', playlistId: found.uploads, maxResults: String(RECENT_VIDEOS) });
  const ids = list(playlist['items']).flatMap((item) => (isObj(item['contentDetails']) ? (str(item['contentDetails']['videoId']) ?? []) : []));
  if (ids.length === 0) return found.stats;
  const videos = await call(key, '/videos', { part: 'snippet,statistics', id: ids.join(',') });
  const recent = list(videos['items']).flatMap((entry) => toYouTubeVideo(entry) ?? []).sort((a, b) => b.publishedAt - a.publishedAt);
  return { ...found.stats, recent };
}
