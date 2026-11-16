import { create } from 'zustand';

/**
 * Claude subscription limits, from the `rate_limit_event` lines in the chat stream
 * (`rate_limit_info.unifiedWindows.<key>.{utilization, resetsAt}`) and the plan from the
 * reply to `initialize`. The last values are kept in localStorage so they show on startup.
 */

export interface UsageWindow {
  key: string;
  /** 0 to 1. */
  utilization: number;
  /** Milliseconds since 1970. */
  resetsAt: number;
}

export interface Usage {
  windows: UsageWindow[];
  plan: string | null;
  updatedAt: number | null;
}

const STORAGE_KEY = 'vision.claudeUsage';
const ORDER = ['five_hour', 'seven_day'];
const LABELS: Record<string, string> = { five_hour: 'Session (5 hr)', seven_day: 'Weekly (7 day)' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** "seven_day_fable" → "Fable limit": per-model windows are named after their model. */
export function windowLabel(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const rest = key.replace(/^(five_hour|seven_day)_?/, '').replace(/_/g, ' ').trim();
  return rest ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)} limit` : key;
}

/** The windows in a rate_limit_event, or null for any other event. */
export function parseRateLimit(event: unknown): UsageWindow[] | null {
  if (!isRecord(event) || event['type'] !== 'rate_limit_event') return null;
  const info = event['rate_limit_info'];
  const windows = isRecord(info) ? info['unifiedWindows'] : null;
  if (!isRecord(windows)) return null;
  return Object.entries(windows).flatMap(([key, raw]) => {
    if (!isRecord(raw)) return [];
    const { utilization, resetsAt } = raw;
    if (typeof utilization !== 'number' || typeof resetsAt !== 'number') return [];
    return [{ key, utilization: Math.min(1, Math.max(0, utilization)), resetsAt: resetsAt * 1000 }];
  });
}

/** The plan name from the reply to `initialize` (e.g. "Claude Pro"). Nothing else from the account is kept. */
export function parsePlan(event: unknown): string | null {
  if (!isRecord(event) || event['type'] !== 'control_response' || !isRecord(event['response'])) return null;
  const reply = event['response']['response'];
  const account = isRecord(reply) ? reply['account'] : null;
  const plan = isRecord(account) ? account['subscriptionType'] : null;
  return typeof plan === 'string' && plan.length <= 40 ? plan : null;
}

/** New values win; windows the event didn't mention stay until they reset. Known windows first. */
export function mergeWindows(current: UsageWindow[], incoming: UsageWindow[], now: number): UsageWindow[] {
  const byKey = new Map(current.filter((window) => window.resetsAt > now).map((window) => [window.key, window]));
  for (const window of incoming) byKey.set(window.key, window);
  const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
  return [...byKey.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

function isWindow(value: unknown): value is UsageWindow {
  return isRecord(value) && typeof value['key'] === 'string' && typeof value['utilization'] === 'number' && typeof value['resetsAt'] === 'number';
}

function load(): Usage {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (isRecord(saved) && Array.isArray(saved['windows'])) {
      return {
        windows: saved['windows'].filter(isWindow),
        plan: typeof saved['plan'] === 'string' ? saved['plan'] : null,
        updatedAt: typeof saved['updatedAt'] === 'number' ? saved['updatedAt'] : null,
      };
    }
  } catch {
    // Unreadable or blocked storage: start empty.
  }
  return { windows: [], plan: null, updatedAt: null };
}

function save(usage: Usage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Showing usage only until restart is fine.
  }
}

export const useUsage = create<Usage>(() => load());

/** Feed every chat event through here; it keeps the limits and plan up to date. */
export function recordChatEvent(event: unknown): void {
  const windows = parseRateLimit(event);
  const plan = parsePlan(event);
  if (!windows && !plan) return;
  const current = useUsage.getState();
  const now = Date.now();
  const next: Usage = windows
    ? { ...current, windows: mergeWindows(current.windows, windows, now), updatedAt: now }
    : { ...current, plan };
  useUsage.setState(next);
  save(next);
}
