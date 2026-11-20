import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_SNAPSHOTS, PLATFORMS, type Platform, type Snapshot } from '../../../shared/content';
import { decryptSecret, encryptSecret, writePrivateJson } from '../../../main/secrets';
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

let config: ContentConfig | null = null;
let writing: Promise<void> = Promise.resolve();

const configPath = () => join(app.getPath('userData'), 'content.json');

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

export function loadContentConfig(): ContentConfig {
  if (config) return config;
  try {
    config = parse(JSON.parse(readFileSync(configPath(), 'utf8')));
  } catch {
    config = empty();
  }
  return config;
}

/** Throws if the Keychain can't encrypt (KeychainUnavailableError). */
export function saveContentConfig(next: ContentConfig): Promise<void> {
  const onDisk = {
    youtube: next.youtube ? { key: encryptSecret(next.youtube.key), channel: next.youtube.channel } : null,
    instagram: next.instagram ? { token: encryptSecret(next.instagram.token), refreshedAt: next.instagram.refreshedAt } : null,
    history: next.history,
  };
  config = next;
  writing = writing.then(() => writePrivateJson(configPath(), onDisk));
  return writing;
}
