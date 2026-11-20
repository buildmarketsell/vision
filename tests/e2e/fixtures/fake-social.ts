import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Stands in for the YouTube Data API and Instagram's Graph API, so the Content test needs no account or internet. */
export interface FakeSocial {
  base: string;
  close: () => void;
}

export async function startFakeSocial(): Promise<FakeSocial> {
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const json = (status: number, value: unknown) => response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
    const ytKey = url.searchParams.get('key');
    const igToken = url.searchParams.get('access_token');
    if (url.pathname.startsWith('/youtube/') && ytKey !== 'good-key') {
      json(400, { error: { errors: [{ reason: 'keyInvalid' }] } });
    } else if (url.pathname === '/youtube/v3/channels') {
      const found = url.searchParams.get('forHandle') === '@dan';
      json(200, {
        items: found
          ? [{ id: 'UCfake', snippet: { title: 'Dan Romanciuc', customUrl: '@dan' }, statistics: { subscriberCount: '12400', viewCount: '830000', videoCount: '48' }, contentDetails: { relatedPlaylists: { uploads: 'UUfake' } } }]
          : [],
      });
    } else if (url.pathname === '/youtube/v3/playlistItems') {
      json(200, { items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] });
    } else if (url.pathname === '/youtube/v3/videos') {
      json(200, {
        items: [
          { id: 'v1', snippet: { title: 'How I run my store with AI', publishedAt: '2026-11-15T10:00:00Z' }, statistics: { viewCount: '15300', likeCount: '820', commentCount: '64' } },
          { id: 'v2', snippet: { title: 'A week in Madrid', publishedAt: '2026-11-08T10:00:00Z' }, statistics: { viewCount: '4100', likeCount: '210', commentCount: '12' } },
        ],
      });
    } else if (url.pathname.startsWith('/instagram/') && igToken !== 'good-token') {
      json(400, { error: { message: 'Invalid OAuth access token', code: 190 } });
    } else if (url.pathname === '/instagram/me') {
      json(200, { username: 'dan', name: 'Dan', followers_count: 3100, media_count: 210 });
    } else if (url.pathname === '/instagram/me/media') {
      json(200, { data: [{ id: 'p1', caption: 'Morning routine\nmore', media_type: 'VIDEO', permalink: 'https://www.instagram.com/reel/p1/', timestamp: '2026-11-18T09:00:00+0000', like_count: 340, comments_count: 21 }] });
    } else if (url.pathname === '/instagram/me/insights') {
      json(200, { data: [{ name: 'views', total_value: { value: 52000 } }, { name: 'reach', total_value: { value: 18000 } }, { name: 'profile_views', total_value: { value: 900 } }] });
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}
