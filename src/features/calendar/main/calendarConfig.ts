import { app, safeStorage } from 'electron';
import { readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GoogleError, type GoogleClient } from './googleAuth';

/** What is saved in userData/calendar.json. The client secret and sign-ins are encrypted with the macOS Keychain. */
export interface CalendarConfig {
  client: GoogleClient | null;
  accounts: Array<{ email: string; refreshToken: string }>;
  /** Shown/hidden calendars Dan changed, by key; others follow Google's own setting. */
  visibility: Record<string, boolean>;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

let config: CalendarConfig | null = null;
let writing: Promise<void> = Promise.resolve();

const configPath = () => join(app.getPath('userData'), 'calendar.json');

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) throw new GoogleError('This Mac cannot keep the sign-in safe right now (Keychain unavailable).');
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return null;
  }
}

function parse(raw: unknown): CalendarConfig {
  if (!isObj(raw)) return { client: null, accounts: [], visibility: {} };
  const client = isObj(raw['client']) && typeof raw['client']['id'] === 'string' ? { id: raw['client']['id'], secret: decrypt(raw['client']['secret']) } : null;
  const accounts = (Array.isArray(raw['accounts']) ? raw['accounts'] : []).flatMap((item) => {
    const refreshToken = isObj(item) ? decrypt(item['refreshToken']) : null;
    return isObj(item) && typeof item['email'] === 'string' && refreshToken ? [{ email: item['email'], refreshToken }] : [];
  });
  const visibility = Object.fromEntries(Object.entries(isObj(raw['visibility']) ? raw['visibility'] : {}).filter(([, shown]) => typeof shown === 'boolean')) as Record<string, boolean>;
  return { client: client?.secret ? { id: client.id, secret: client.secret } : null, accounts, visibility };
}

export function loadConfig(): CalendarConfig {
  if (config) return config;
  try {
    config = parse(JSON.parse(readFileSync(configPath(), 'utf8')));
  } catch {
    config = { client: null, accounts: [], visibility: {} };
  }
  return config;
}

/** Saves through a temp file, readable only by Dan's user. Throws if the Keychain can't encrypt. */
export function saveConfig(next: CalendarConfig): Promise<void> {
  const onDisk = {
    client: next.client ? { id: next.client.id, secret: encrypt(next.client.secret) } : null,
    accounts: next.accounts.map((account) => ({ email: account.email, refreshToken: encrypt(account.refreshToken) })),
    visibility: next.visibility,
  };
  config = next;
  writing = writing.then(async () => {
    await writeFile(`${configPath()}.tmp`, JSON.stringify(onDisk, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(`${configPath()}.tmp`, configPath());
  });
  return writing;
}
