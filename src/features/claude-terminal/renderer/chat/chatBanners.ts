import type { UsageWindow } from '../usage/usageStore';
import type { McpServer } from './sessionInfo';

/**
 * The bars above the composer, like Claude Code in VS Code: usage limits and connection problems.
 * Connectors that fail or need sign-in get no bar: Claude says so when one is needed (Dan, 2026-11-19, twice).
 * Pure: the same inputs give the same bars. Ids change when the content does, so a dismissed bar
 * comes back when something new happens (a limit is hit, another server fails).
 */

export type BannerTone = 'info' | 'warning' | 'error';

export interface Banner {
  id: string;
  tone: BannerTone;
  text: string;
}

const DAY_MS = 24 * 60 * 60_000;
const LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour limit', seven_day: 'weekly limit' };

/** "seven_day_fable" → "Fable limit". */
function limitName(key: string): string {
  const known = LIMIT_NAMES[key];
  if (known) return known;
  const model = key.replace(/^(five_hour|seven_day)_?/, '').replace(/_/g, ' ').trim();
  return model ? `${model.charAt(0).toUpperCase()}${model.slice(1)} limit` : key;
}

/** "resets at 1:40 AM" within a day, "resets Wed 7:00 PM" further out. */
export function resetPhrase(resetsAt: number, now: number): string {
  const date = new Date(resetsAt);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return resetsAt - now < DAY_MS ? `resets at ${time}` : `resets ${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

function usageBanners(windows: UsageWindow[], now: number): Banner[] {
  return windows.flatMap((window): Banner[] => {
    if (window.resetsAt <= now || window.status === 'allowed') return [];
    const reset = resetPhrase(window.resetsAt, now);
    if (window.status === 'rejected') {
      return [{ id: `limit-${window.key}-${window.resetsAt}`, tone: 'error', text: `You've hit your ${limitName(window.key)} · ${reset}` }];
    }
    const percent = Math.round(window.utilization * 100);
    return [{ id: `usage-${window.key}-${window.resetsAt}`, tone: 'warning', text: `You've used ${percent}% of your ${limitName(window.key)} · ${reset}` }];
  });
}

function connectionBanners(servers: McpServer[]): Banner[] {
  const browser = servers.some((server) => /chrome/i.test(server.name) && server.status === 'connected');
  return browser ? [{ id: 'browser-connected', tone: 'info', text: 'Browser connected' }] : [];
}

export function chatBanners(windows: UsageWindow[], servers: McpServer[], now: number): Banner[] {
  return [...usageBanners(windows, now), ...connectionBanners(servers)];
}
