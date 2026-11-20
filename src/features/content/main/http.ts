/** A problem Dan can act on; its message is shown as is. */
export class ContentError extends Error {}

export type Obj = Record<string, unknown>;
export const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
export const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
/** YouTube sends counts as text ("1234"), Instagram as numbers. */
export const num = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};
export const list = (value: unknown): Obj[] => (Array.isArray(value) ? value.filter(isObj) : []);

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Where the APIs live. End-to-end tests point both at a fake server (VISION_CONTENT_TEST_BASE).
 * Only https in real use: keys and tokens travel in the request.
 */
export function contentEndpoints() {
  const test = process.env['VISION_CONTENT_TEST_BASE'];
  return {
    youtube: test ? `${test}/youtube/v3` : 'https://www.googleapis.com/youtube/v3',
    instagram: test ? `${test}/instagram` : 'https://graph.instagram.com',
  };
}

/** GETs JSON; `explain` turns a refused reply into the error Dan sees. */
export async function getJson(url: string, explain: (status: number, body: Obj) => Error): Promise<Obj> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body: unknown = await response.json().catch(() => ({}));
  const obj = isObj(body) ? body : {};
  if (!response.ok) throw explain(response.status, obj);
  return obj;
}
