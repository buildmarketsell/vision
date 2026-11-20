import { ipcMain } from 'electron';
import { addSnapshot, dayKey, isPlatform, parseChannel, type AccountStats, type ContentState, type Platform, type PlatformState } from '../../../shared/content';
import { IPC } from '../../../shared/ipc';
import { logError } from '../../../main/log';
import { KeychainUnavailableError } from '../../../main/secrets';
import { loadContentConfig, saveContentConfig } from './contentConfig';
import { ContentError } from './http';
import { fetchInstagram, refreshInstagramToken } from './instagramApi';
import { fetchYouTube } from './youtubeApi';

/** Fetched again at most this often (YouTube's free quota is 10,000 units a day; one refresh costs 3). */
const CACHE_MS = 10 * 60_000;
/** Instagram tokens last 60 days; renewing weekly keeps them alive while VISION is used. */
const TOKEN_REFRESH_MS = 7 * 24 * 60 * 60_000;

type Fetched = { stats: AccountStats | null; error?: string; at: number };
const cache = new Map<Platform, Fetched>();

function messageFor(error: unknown): string {
  if (error instanceof ContentError || error instanceof KeychainUnavailableError) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return 'The platform took too long to answer. Check your internet.';
  logError('Content request failed', error instanceof Error ? error.message : 'unknown');
  return 'The numbers could not be read. Check your internet and try again.';
}

async function keepInstagramTokenFresh(): Promise<void> {
  const config = loadContentConfig();
  if (!config.instagram || Date.now() - config.instagram.refreshedAt < TOKEN_REFRESH_MS) return;
  const token = await refreshInstagramToken(config.instagram.token);
  if (token) await saveContentConfig({ ...config, instagram: { token, refreshedAt: Date.now() } });
}

async function fetchPlatform(platform: Platform): Promise<AccountStats> {
  const config = loadContentConfig();
  if (platform === 'youtube') {
    if (!config.youtube) throw new ContentError('Connect YouTube first.');
    return fetchYouTube(config.youtube.key, config.youtube.channel);
  }
  if (!config.instagram) throw new ContentError('Connect Instagram first.');
  await keepInstagramTokenFresh();
  return fetchInstagram(loadContentConfig().instagram?.token ?? config.instagram.token);
}

/** Fetches one platform and records today's reading. Errors are kept with the last good numbers. */
async function refresh(platform: Platform): Promise<void> {
  const before = cache.get(platform);
  try {
    const stats = await fetchPlatform(platform);
    cache.set(platform, { stats, at: Date.now() });
    const config = loadContentConfig();
    const history = addSnapshot(config.history[platform], { day: dayKey(Date.now()), followers: stats.followers, totalViews: stats.totalViews });
    await saveContentConfig({ ...config, history: { ...config.history, [platform]: history } });
  } catch (error) {
    cache.set(platform, { stats: before?.stats ?? null, error: messageFor(error), at: Date.now() });
  }
}

function platformState(platform: Platform): PlatformState {
  const config = loadContentConfig();
  const connected = platform === 'youtube' ? config.youtube !== null : config.instagram !== null;
  const fetched = cache.get(platform);
  if (!connected) return { connected: false, ...(fetched?.error ? { error: fetched.error } : {}) };
  return { connected: true, stats: fetched?.stats ?? null, history: config.history[platform], ...(fetched?.error ? { error: fetched.error } : {}) };
}

async function currentState(force: boolean): Promise<ContentState> {
  const config = loadContentConfig();
  const due = (['youtube', 'instagram'] as const).filter((platform) => {
    const connected = platform === 'youtube' ? config.youtube : config.instagram;
    const fetched = cache.get(platform);
    return connected && (force || !fetched || Date.now() - fetched.at > CACHE_MS);
  });
  await Promise.all(due.map(refresh));
  return { youtube: platformState('youtube'), instagram: platformState('instagram'), fetchedAt: Date.now() };
}

async function withError(platform: Platform, error: string): Promise<ContentState> {
  const state = await currentState(false);
  return { ...state, [platform]: { ...state[platform], error } };
}

/** Tries the new connection before saving it, so a wrong key never replaces a working one. */
async function connect(platform: Platform, attempt: () => Promise<AccountStats>, save: () => Promise<void>): Promise<ContentState> {
  try {
    await attempt();
    await save();
    cache.delete(platform);
    return await currentState(false);
  } catch (error) {
    return withError(platform, messageFor(error));
  }
}

const asText = (value: unknown, max = 600) => (typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null);

export function registerContent(): void {
  ipcMain.handle(IPC.contentState, (_event, force: unknown) => currentState(force === true));

  ipcMain.handle(IPC.contentConnectYouTube, (_event, key: unknown, channelInput: unknown) => {
    const apiKey = asText(key, 200);
    const channel = parseChannel(asText(channelInput, 200) ?? '');
    if (!apiKey || !channel) return withError('youtube', 'Paste the API key and your channel (e.g. @yourchannel or its link).');
    return connect(
      'youtube',
      () => fetchYouTube(apiKey, channel),
      () => saveContentConfig({ ...loadContentConfig(), youtube: { key: apiKey, channel } }),
    );
  });

  ipcMain.handle(IPC.contentConnectInstagram, (_event, tokenInput: unknown) => {
    const token = asText(tokenInput, 1000);
    if (!token || /\s/.test(token)) return withError('instagram', 'Paste the Instagram access token.');
    return connect(
      'instagram',
      () => fetchInstagram(token),
      () => saveContentConfig({ ...loadContentConfig(), instagram: { token, refreshedAt: Date.now() } }),
    );
  });

  ipcMain.handle(IPC.contentDisconnect, async (_event, platform: unknown) => {
    if (!isPlatform(platform)) return currentState(false);
    const config = loadContentConfig();
    cache.delete(platform);
    await saveContentConfig({ ...config, [platform]: null }).catch((error: unknown) => logError('Could not save content settings', error));
    return currentState(false);
  });
}
