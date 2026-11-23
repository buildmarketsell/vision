import { app } from 'electron';
import { join } from 'node:path';
import { MAX_SNAPSHOTS, PLATFORMS, type Platform, type Snapshot } from '../../../shared/content';
import { createDocumentStore } from '../../../main/documentStore';
import { decryptSecret, encryptSecret } from '../../../main/secrets';
import { isObj, num, str } from './http';

export type ChannelRef = { forHandle: string } | { id: string };

/** What is saved in userData/content.json. The API key and token are encrypted with the macOS Keychain. */
export interface ContentConfig {
  youtube: { key: string; channel: ChannelRef } | null;
  instagram: { token: string; refreshedAt: number } | null;
  /** Kept after disconnecting, so reconnecting continues the same growth line. */
  history: Record<Platform, Snapshot[]>;
}

const empty = (): ContentConfig => ({ youtube: null, instagram: null, history: { youtube: [], instagram: [] } });

function parseChannel(raw: unknown): ChannelRef | null {
  if (!isObj(raw)) return null;
  const handle = str(raw['forHandle']);
  const id = str(raw['id']);
  return handle ? { forHandle: handle } : id ? { id } : null;
}

function parseHistory(raw: unknown): Snapshot[] {
  return (Array.isArray(raw) ? raw : []).flatMap((item) => {
    const day = isObj(item) ? str(item['day']) : null;
    const followers = isObj(item) ? num(item['followers']) : null;
    return isObj(item) && day && /^\d{4}-\d{2}-\d{2}$/.test(day) && followers !== null ? [{ day, followers, totalViews: num(item['totalViews']) }] : [];
  }).slice(-MAX_SNAPSHOTS);
}

function parse(raw: unknown): ContentConfig {
  if (!isObj(raw)) return empty();
  const youtube = isObj(raw['youtube']) ? raw['youtube'] : {};
  const instagram = isObj(raw['instagram']) ? raw['instagram'] : {};
  const key = decryptSecret(youtube['key']);
  const channel = parseChannel(youtube['channel']);
  const token = decryptSecret(instagram['token']);
  const history = isObj(raw['history']) ? raw['history'] : {};
  return {
    youtube: key && channel ? { key, channel } : null,
    instagram: token ? { token, refreshedAt: num(instagram['refreshedAt']) ?? 0 } : null,
    history: Object.fromEntries(PLATFORMS.map((platform) => [platform, parseHistory(history[platform])])) as Record<Platform, Snapshot[]>,
  };
}

const document = createDocumentStore<ContentConfig>({
  path: () => join(app.getPath('userData'), 'content.json'),
  read: parse,
  write: (config) => ({
    youtube: config.youtube ? { key: encryptSecret(config.youtube.key), channel: config.youtube.channel } : null,
    instagram: config.instagram ? { token: encryptSecret(config.instagram.token), refreshedAt: config.instagram.refreshedAt } : null,
    history: config.history,
  }),
});

export const loadContentConfig = (): ContentConfig => document.get();

/** Throws if the Keychain can't encrypt (KeychainUnavailableError). */
export const saveContentConfig = (next: ContentConfig): Promise<void> => document.set(next);
