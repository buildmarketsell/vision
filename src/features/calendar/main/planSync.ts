import type { GoogleEventBody } from '../../../shared/calendar';
import { PLAN_DAYS, type PlanBlock } from '../../../shared/plan';
import { loadConfig } from './calendarConfig';
import { deleteEvent, insertEvent, listEvents, patchEvent, visionTags } from './googleApi';
import { accessToken, GoogleError } from './googleAuth';

const DAY_MS = 24 * 60 * 60_000;
const BLOCK_TAG = { privateExtendedProperty: 'visionBlock=1' };
const DESCRIPTION = 'Planned by VISION. Mark the to-do done in VISION and this block goes away.';

interface Existing {
  id: string;
  key: string;
  title: string;
  start: number;
  end: number;
}

const blockKey = (taskId: string, start: number, end: number) => `${taskId}|${start}|${end}`;
const at = (ms: number, timeZone: string) => ({ dateTime: new Date(ms).toISOString(), timeZone });

function toExisting(entry: Record<string, unknown>): Existing | null {
  const id = typeof entry['id'] === 'string' ? entry['id'] : null;
  const taskId = visionTags(entry)['visionTask'];
  const time = (value: unknown) => {
    const text = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['dateTime'] : null;
    return typeof text === 'string' ? Date.parse(text) : NaN;
  };
  const start = time(entry['start']);
  const end = time(entry['end']);
  if (!id || !taskId || Number.isNaN(start) || Number.isNaN(end) || entry['status'] === 'cancelled') return null;
  return { id, key: blockKey(taskId, start, end), title: typeof entry['summary'] === 'string' ? entry['summary'] : '', start, end };
}

/**
 * Makes the picked Google calendar show exactly the planned blocks from now on. Only events VISION tagged as its own
 * blocks are ever changed; past blocks stay as a record. One that already started but is no longer planned
 * (the to-do was finished) is cut to end now.
 */
export async function mirrorToGoogle(calendarKey: string, blocks: PlanBlock[], now: number): Promise<number> {
  const config = loadConfig();
  const account = config.accounts.find((item) => calendarKey.startsWith(`${item.email}|`));
  if (!config.client || !account) throw new GoogleError('The calendar picked for planned tasks is not signed in. Pick another one in Plan settings.');
  const token = await accessToken(config.client, account.refreshToken);
  const calendarId = calendarKey.slice(account.email.length + 1);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const existing = (await listEvents(token, calendarId, now - DAY_MS, now + (PLAN_DAYS + 1) * DAY_MS, BLOCK_TAG)).flatMap((entry) => toExisting(entry) ?? []);
  const wanted = new Map(blocks.filter((block) => block.end > now).map((block) => [blockKey(block.taskId, block.start, block.end), block]));
  let writes = 0;
  for (const event of existing) {
    if (event.end <= now) continue;
    const block = wanted.get(event.key);
    if (block) {
      wanted.delete(event.key);
      if (event.title !== block.title) await patchEvent(token, calendarId, event.id, { summary: block.title });
      else continue;
    } else if (event.start < now) {
      await patchEvent(token, calendarId, event.id, { end: at(now, timeZone) });
    } else {
      await deleteEvent(token, calendarId, event.id);
    }
    writes += 1;
  }
  for (const block of wanted.values()) {
    const body: GoogleEventBody = {
      summary: block.title,
      description: DESCRIPTION,
      start: at(block.start, timeZone),
      end: at(block.end, timeZone),
      extendedProperties: { private: { visionBlock: '1', visionTask: block.taskId } },
    };
    await insertEvent(token, calendarId, body);
    writes += 1;
  }
  return writes;
}
