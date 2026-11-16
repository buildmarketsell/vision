import { describe, expect, it } from 'vitest';
import { cleanInboxText, normalizeInbox } from '../../src/shared/inbox';
import { dayLabel, groupByDay } from '../../src/features/inbox/renderer/inboxFormat';

const at = (iso: string) => new Date(iso).getTime();
const message = (id: string, iso: string) => ({ id, text: id, createdAt: at(iso), done: false });

describe('inbox', () => {
  it('keeps only well-formed saved messages, oldest first', () => {
    const saved = [message('b', '2026-11-17T10:00'), { id: 1 }, 'junk', { ...message('a', '2026-11-16T10:00'), done: 'yes' }];
    expect(normalizeInbox(saved).map((item) => [item.id, item.done])).toEqual([['a', false], ['b', false]]);
    expect(normalizeInbox({ not: 'a list' })).toEqual([]);
  });
  it('trims what you send and refuses empty text', () => {
    expect(cleanInboxText('  buy milk \n')).toBe('buy milk');
    expect(cleanInboxText('   ')).toBeNull();
    expect(cleanInboxText(42)).toBeNull();
  });
  it('labels days like WhatsApp', () => {
    const now = at('2026-11-17T12:00');
    expect(dayLabel(at('2026-11-17T08:00'), now)).toBe('Today');
    expect(dayLabel(at('2026-11-16T23:59'), now)).toBe('Yesterday');
    expect(dayLabel(at('2026-10-01T09:00'), now)).toContain('2026');
  });
  it('puts a tail on the first bubble of each run', () => {
    const now = at('2026-11-17T12:00');
    const days = groupByDay([message('a', '2026-11-16T09:00'), message('b', '2026-11-17T09:00'), message('c', '2026-11-17T09:02'), message('d', '2026-11-17T10:00')], now);
    expect(days.map((day) => day.label)).toEqual(['Yesterday', 'Today']);
    expect(days[1]?.messages.map((item) => item.tail)).toEqual([true, false, true]);
  });
});
