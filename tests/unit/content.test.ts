import { describe, expect, it } from 'vitest';
import { addSnapshot, growth, MAX_SNAPSHOTS, parseChannel, type Snapshot } from '../../src/shared/content';
import { toYouTubeChannel, toYouTubeVideo } from '../../src/features/content/main/youtubeApi';
import { toInstagramAccount, toInstagramPeriod, toInstagramPost } from '../../src/features/content/main/instagramApi';

describe('channel input', () => {
  it('accepts a handle, a channel link or a UC id', () => {
    expect(parseChannel('@danromanciuc')).toEqual({ forHandle: '@danromanciuc' });
    expect(parseChannel('danromanciuc')).toEqual({ forHandle: '@danromanciuc' });
    expect(parseChannel(' https://www.youtube.com/@dan.romanciuc/videos ')).toEqual({ forHandle: '@dan.romanciuc' });
    expect(parseChannel('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toEqual({ id: 'UCabcdefghijklmnopqrstuv' });
  });

  it('refuses anything else', () => {
    expect(parseChannel('')).toBeNull();
    expect(parseChannel('https://example.com/watch?v=1')).toBeNull();
    expect(parseChannel('two words')).toBeNull();
  });
});

describe('daily readings and growth', () => {
  const day = (d: string, followers: number, totalViews: number | null = null): Snapshot => ({ day: d, followers, totalViews });
  const now = new Date(2026, 10, 20, 12).getTime();

  it('keeps one reading per day, oldest first, and a maximum', () => {
    const history = addSnapshot(addSnapshot([day('2026-11-19', 10)], day('2026-11-20', 12)), day('2026-11-20', 15));
    expect(history).toEqual([day('2026-11-19', 10), day('2026-11-20', 15)]);
    const full = Array.from({ length: MAX_SNAPSHOTS }, (_, index) => day(`2025-${String(index).padStart(5, '0')}`, index));
    expect(addSnapshot(full, day('2026-11-20', 1))).toHaveLength(MAX_SNAPSHOTS);
  });

  it('measures growth inside the window only, and nothing from a single reading', () => {
    const history = [day('2026-10-01', 50), day('2026-11-14', 100, 1000), day('2026-11-17', 110), day('2026-11-20', 130, 1600)];
    expect(growth(history, 7, (item) => item.followers, now)).toBe(30);
    expect(growth(history, 28, (item) => item.totalViews, now)).toBe(600);
    expect(growth([day('2026-11-20', 130)], 7, (item) => item.followers, now)).toBeNull();
  });
});

describe('YouTube replies', () => {
  it('reads the channel (counts arrive as text)', () => {
    const channel = toYouTubeChannel({
      id: 'UC1',
      snippet: { title: 'Dan', customUrl: '@dan', thumbnails: { default: { url: 'https://yt3.ggpht.com/a' } } },
      statistics: { subscriberCount: '1200', viewCount: '45000', videoCount: '31' },
      contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
    });
    expect(channel).toEqual({
      uploads: 'UU1',
      stats: { name: 'Dan', handle: '@dan', url: 'https://www.youtube.com/@dan', avatar: 'https://yt3.ggpht.com/a', followers: 1200, totalViews: 45000, posts: 31, last28Days: null, recent: [] },
    });
    expect(toYouTubeChannel({})).toBeNull();
  });

  it('reads a video and leaves hidden likes empty', () => {
    expect(toYouTubeVideo({ id: 'v1', snippet: { title: 'Hi', publishedAt: '2026-11-01T10:00:00Z' }, statistics: { viewCount: '900', commentCount: '4' } })).toEqual({
      id: 'v1',
      title: 'Hi',
      url: 'https://www.youtube.com/watch?v=v1',
      thumbnail: null,
      publishedAt: Date.parse('2026-11-01T10:00:00Z'),
      views: 900,
      likes: null,
      comments: 4,
    });
    expect(toYouTubeVideo({ id: 'v2', snippet: {} })).toBeNull();
  });
});

describe('Instagram replies', () => {
  it('reads the account, a reel and the 28-day totals', () => {
    expect(toInstagramAccount({ username: 'dan', followers_count: 800, media_count: 40 })).toMatchObject({ name: 'dan', handle: '@dan', followers: 800, posts: 40, url: 'https://www.instagram.com/dan/' });
    expect(toInstagramAccount({})).toBeNull();
    expect(
      toInstagramPost({ id: 'p1', caption: 'First line\nmore', media_type: 'VIDEO', media_url: 'https://x/video.mp4', thumbnail_url: 'https://x/t.jpg', permalink: 'https://www.instagram.com/reel/p1/', timestamp: '2026-11-02T09:00:00+0000', like_count: 50, comments_count: 3 }),
    ).toMatchObject({ title: 'First line', thumbnail: 'https://x/t.jpg', likes: 50, comments: 3, views: null });
    expect(toInstagramPeriod({ data: [{ name: 'views', total_value: { value: 5000 } }, { name: 'reach', total_value: { value: 1200 } }] })).toEqual({ views: 5000, reach: 1200, profileViews: null, interactions: null });
  });
});
