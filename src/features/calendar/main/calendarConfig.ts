import { app } from 'electron';
import { join } from 'node:path';
import { createDocumentStore } from '../../../main/documentStore';
import { decryptSecret as decrypt, encryptSecret as encrypt } from '../../../main/secrets';
import type { GoogleClient } from './googleAuth';

/** What is saved in userData/calendar.json. The client secret and sign-ins are encrypted with the macOS Keychain. */
export interface CalendarConfig {
  client: GoogleClient | null;
  accounts: Array<{ email: string; refreshToken: string }>;
  /** Shown/hidden calendars Dan changed, by key; others follow Google's own setting. */
  visibility: Record<string, boolean>;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

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

const document = createDocumentStore<CalendarConfig>({
  path: () => join(app.getPath('userData'), 'calendar.json'),
  read: parse,
  write: (config) => ({
    client: config.client ? { id: config.client.id, secret: encrypt(config.client.secret) } : null,
    accounts: config.accounts.map((account) => ({ email: account.email, refreshToken: encrypt(account.refreshToken) })),
    visibility: config.visibility,
  }),
});

export const loadConfig = (): CalendarConfig => document.get();

/** Saves with secrets encrypted, readable only by Dan's user. Throws if the Keychain can't encrypt. */
export const saveConfig = (next: CalendarConfig): Promise<void> => document.set(next);
