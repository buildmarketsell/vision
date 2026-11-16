import { describe, expect, it } from 'vitest';
import { mergeWindows, parsePlan, parseRateLimit, windowLabel } from '../../src/features/claude-terminal/renderer/usage/usageStore';
import { resetLabel } from '../../src/features/claude-terminal/renderer/usage/UsagePanel';

/** Recorded from the real CLI on 2026-11-17. */
const live = {
  type: 'rate_limit_event',
  rate_limit_info: {
    status: 'allowed_warning',
    unifiedWindows: {
      five_hour: { utilization: 0.92, resetsAt: 1794876000, status: 'allowed_warning', surpassedThreshold: 0.9 },
      seven_day: { utilization: 0.48, resetsAt: 1795024800, status: 'allowed' },
    },
  },
};

describe('Claude usage', () => {
  it('reads every window from a rate_limit_event', () => {
    expect(parseRateLimit(live)).toEqual([
      { key: 'five_hour', utilization: 0.92, resetsAt: 1794876000_000 },
      { key: 'seven_day', utilization: 0.48, resetsAt: 1795024800_000 },
    ]);
    expect(parseRateLimit({ type: 'assistant' })).toBeNull();
    expect(parseRateLimit({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 'x' } } } })).toEqual([]);
  });
  it('names known and per-model windows', () => {
    expect(windowLabel('five_hour')).toBe('Session (5 hr)');
    expect(windowLabel('seven_day')).toBe('Weekly (7 day)');
    expect(windowLabel('seven_day_fable')).toBe('Fable limit');
  });
  it('keeps windows until they reset, known ones first', () => {
    const now = 1_000;
    const kept = { key: 'seven_day_fable', utilization: 0.6, resetsAt: 5_000 };
    const expired = { key: 'seven_day_opus', utilization: 0.9, resetsAt: 500 };
    const merged = mergeWindows([kept, expired], [{ key: 'five_hour', utilization: 0.1, resetsAt: 9_000 }], now);
    expect(merged.map((window) => window.key)).toEqual(['five_hour', 'seven_day_fable']);
  });
  it('takes only the plan name from the account', () => {
    const reply = { type: 'control_response', response: { response: { account: { email: 'someone@example.com', subscriptionType: 'Claude Pro' } } } };
    expect(parsePlan(reply)).toBe('Claude Pro');
    expect(parsePlan({ type: 'control_response', response: { response: {} } })).toBeNull();
  });
  it('counts down to the reset', () => {
    const now = new Date('2026-11-17T10:00').getTime();
    expect(resetLabel(now + 35 * 60_000, now)).toBe('Resets in 35 min');
    expect(resetLabel(now + 80 * 60_000, now)).toBe('Resets in 1 h 20 min');
    expect(resetLabel(now - 1, now)).toContain('Reset.');
    expect(resetLabel(now + 3 * 24 * 3_600_000, now)).toMatch(/^Resets \w+/);
  });
});
