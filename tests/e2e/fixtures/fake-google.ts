import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Stands in for Google's sign-in and Calendar API, so the calendar test needs no account or internet. */
export interface FakeGoogle {
  base: string;
  created: Array<Record<string, unknown>>;
  close: () => void;
}

const HOUR = 60 * 60_000;

function body(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let text = '';
    request.on('data', (chunk: Buffer) => (text += chunk.toString()));
    request.on('end', () => resolve(text));
  });
}

/** `blockSignIn` acts like Google's "Access blocked" page: it never sends the browser back. */
export async function startFakeGoogle({ blockSignIn = false } = {}): Promise<FakeGoogle> {
  const created: Array<Record<string, unknown>> = [];
  const at = (hours: number) => {
    const date = new Date(Date.now() + hours * HOUR);
    date.setMinutes(0, 0, 0);
    return date.toISOString();
  };
  const events: Record<string, Array<Record<string, unknown>>> = {
    'dan@example.com': [
      { id: 'garage', summary: 'Call with the garage', location: 'Technowagen', start: { dateTime: at(2) }, end: { dateTime: at(3) } },
      { id: 'plan', summary: 'Weekly Plan', start: { dateTime: at(26) }, end: { dateTime: at(27) } },
    ],
    family: [{ id: 'bday', summary: "Mum's birthday", start: { date: at(50).slice(0, 10) }, end: { date: at(74).slice(0, 10) } }],
  };
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const json = (value: unknown) => response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
    if (url.pathname === '/auth' && blockSignIn) {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end('Access blocked');
    } else if (url.pathname === '/auth') {
      const back = new URL(url.searchParams.get('redirect_uri') ?? '');
      back.searchParams.set('code', 'fake-code');
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      response.writeHead(302, { Location: back.toString() }).end();
    } else if (url.pathname === '/token') {
      const grant = new URLSearchParams(await body(request)).get('grant_type');
      json({ access_token: 'fake-access', expires_in: 3600, ...(grant === 'authorization_code' ? { refresh_token: 'fake-refresh' } : {}) });
    } else if (url.pathname === '/calendar/v3/users/me/calendarList') {
      json({
        items: [
          { id: 'dan@example.com', summary: 'dan@example.com', backgroundColor: '#7986cb', accessRole: 'owner', primary: true, selected: true },
          { id: 'family', summary: 'Family', backgroundColor: '#33b679', accessRole: 'reader' },
        ],
      });
    } else {
      const match = /^\/calendar\/v3\/calendars\/([^/]+)\/events$/.exec(url.pathname);
      const id = decodeURIComponent(match?.[1] ?? '');
      if (!match || !events[id]) {
        response.writeHead(404).end();
      } else if (request.method === 'POST') {
        const event = JSON.parse(await body(request)) as Record<string, unknown>;
        created.push(event);
        events[id].push({ ...event, id: `new-${created.length}` });
        json({ id: `new-${created.length}` });
      } else {
        json({ items: events[id] });
      }
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, created, close: () => server.close() };
}
