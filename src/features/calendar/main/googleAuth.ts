import { shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface GoogleClient {
  id: string;
  secret: string;
}

/** A problem Dan can act on; its message is shown as is. */
export class GoogleError extends Error {}
/** Google no longer accepts an account's saved sign-in: it has to sign in again. */
export class SignInExpiredError extends Error {}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];
const SIGN_IN_TIMEOUT_MS = 3 * 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Google's addresses. End-to-end tests point them at a fake server (VISION_GOOGLE_TEST_BASE) and,
 * having no browser, follow the sign-in page themselves.
 */
export function googleEndpoints() {
  const test = process.env['VISION_GOOGLE_TEST_BASE'];
  return {
    auth: test ? `${test}/auth` : 'https://accounts.google.com/o/oauth2/v2/auth',
    token: test ? `${test}/token` : 'https://oauth2.googleapis.com/token',
    api: test ? `${test}/calendar/v3` : 'https://www.googleapis.com/calendar/v3',
    openBrowser: (url: string): Promise<unknown> => (test ? fetch(url) : shell.openExternal(url)),
  };
}

const base64url = (bytes: Buffer) => bytes.toString('base64url');

const PAGE = (message: string) =>
  `<!doctype html><meta charset="utf-8"><title>VISION</title><body style="font:16px -apple-system;display:grid;place-items:center;height:90vh;color:#37352F"><p>${message}</p></body>`;

interface TokenReply {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenReply> {
  const response = await fetch(googleEndpoints().token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const reply = (await response.json().catch(() => ({}))) as Partial<TokenReply> & { error?: string };
  if (response.ok && typeof reply.access_token === 'string') {
    return { access_token: reply.access_token, expires_in: Number(reply.expires_in) || 3600, ...(reply.refresh_token ? { refresh_token: reply.refresh_token } : {}) };
  }
  if (reply.error === 'invalid_grant') throw new SignInExpiredError('Google needs you to sign in again.');
  if (reply.error === 'invalid_client' || reply.error === 'unauthorized_client') {
    throw new GoogleError('Google did not accept the Client ID or secret. Check them and try again.');
  }
  throw new GoogleError(`Google refused the sign-in (${reply.error ?? response.status}).`);
}

/** Stops the sign-in that is waiting for Google, if any (the Cancel button). */
let cancelWaiting: (() => void) | null = null;

export function cancelSignIn(): void {
  cancelWaiting?.();
}

/** Waits for Google to send the browser back to VISION with a one-time code. */
function waitForCode(state: string) {
  const server = createServer();
  let timer: NodeJS.Timeout | undefined;
  const code = new Promise<string>((resolve, reject) => {
    timer = setTimeout(
      () => reject(new GoogleError('Google never came back to VISION. If Google showed "Access blocked", add your email as a test user in Google Cloud, then try again.')),
      SIGN_IN_TIMEOUT_MS,
    );
    cancelWaiting = () => reject(new GoogleError('Sign-in cancelled.'));
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/') {
        response.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get('error');
      const value = url.searchParams.get('code');
      const valid = url.searchParams.get('state') === state && !error && value;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(PAGE(valid ? 'Signed in. You can close this tab and go back to VISION.' : 'Sign-in did not finish. Go back to VISION and try again.'));
      if (valid) resolve(value);
      else reject(new GoogleError(error === 'access_denied' ? 'Sign-in was cancelled.' : 'Sign-in did not finish. Try again.'));
    });
  });
  const listening = new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
  const close = () => {
    clearTimeout(timer);
    cancelWaiting = null;
    server.close();
  };
  return { code, listening, close };
}

/** Opens Google's sign-in in the browser (PKCE, loopback redirect) and returns the lasting refresh token. */
export async function signIn(client: GoogleClient): Promise<string> {
  const verifier = base64url(randomBytes(32));
  const state = base64url(randomBytes(16));
  const wait = waitForCode(state);
  try {
    const redirectUri = `http://127.0.0.1:${await wait.listening}`;
    const query = new URLSearchParams({
      client_id: client.id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      code_challenge: base64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    await googleEndpoints().openBrowser(`${googleEndpoints().auth}?${query}`);
    const code = await wait.code;
    const reply = await tokenRequest({
      client_id: client.id,
      client_secret: client.secret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    if (!reply.refresh_token) throw new GoogleError('Google did not give VISION a lasting sign-in. Try again.');
    return reply.refresh_token;
  } finally {
    wait.close();
  }
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

/** A short-lived access token for an account, reused until a minute before it expires. */
export async function accessToken(client: GoogleClient, refreshToken: string): Promise<string> {
  const cached = accessTokens.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const reply = await tokenRequest({ client_id: client.id, client_secret: client.secret, refresh_token: refreshToken, grant_type: 'refresh_token' });
  accessTokens.set(refreshToken, { token: reply.access_token, expiresAt: Date.now() + reply.expires_in * 1000 });
  return reply.access_token;
}

export function forgetAccessToken(refreshToken: string): void {
  accessTokens.delete(refreshToken);
}
