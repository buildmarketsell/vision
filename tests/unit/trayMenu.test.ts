import { describe, expect, it } from 'vitest';
import { trayMenu, trayTitle, type TrayItem } from '../../src/features/focus/main/trayMenu';
import type { Glance } from '../../src/shared/glance';

const labels = (items: TrayItem[]) => items.map((item) => ('separator' in item ? '—' : item.label));

describe('menu bar title', () => {
  it('is empty when idle (only the icon shows)', () => {
    expect(trayTitle({ kind: 'idle' })).toBe('');
  });

  it('shows the clock and a short task name', () => {
    expect(trayTitle({ kind: 'focus', title: 'Write the advertorial for Moérie', clock: '18:42', progress: 0.2, paused: false, hasTodo: true })).toBe('18:42  Write the adverto…');
    expect(trayTitle({ kind: 'focus', title: 'Focus', clock: '3:10', progress: null, paused: true, hasTodo: false })).toBe('Paused 3:10  Focus');
  });

  it('keeps only the clock while the island shows the name', () => {
    expect(trayTitle({ kind: 'focus', title: 'Write VSL', clock: '18:42', progress: 0.2, paused: false, hasTodo: true }, false)).toBe('18:42');
    expect(trayTitle({ kind: 'check-in', title: 'Write VSL', hasTodo: true }, false)).toBe('Done?');
  });

  it('asks at a check-in and counts down to a meeting', () => {
    expect(trayTitle({ kind: 'check-in', title: 'Write VSL', hasTodo: true })).toBe('Done?  Write VSL');
    expect(trayTitle({ kind: 'meeting', id: 'm', title: 'Call with Kilo', clock: '4:12', joinUrl: null, focus: null })).toBe('4:12  Call with Kilo');
  });
});

describe('menu bar menu', () => {
  it('offers the focus lengths when idle', () => {
    expect(labels(trayMenu({ kind: 'idle' }))).toEqual(['Focus 15 min', 'Focus 25 min', 'Focus 50 min', 'Stopwatch', '—', 'Open VISION']);
    expect(trayMenu({ kind: 'idle' })[1]).toMatchObject({ run: { type: 'start', minutes: 25 } });
  });

  it('controls a running focus, with Done only for a to-do', () => {
    const focus: Glance = { kind: 'focus', title: 'Write VSL', clock: '18:42', progress: 0.2, paused: false, hasTodo: true };
    expect(labels(trayMenu(focus))).toEqual(['Write VSL', 'Pause', '+5 min', 'Done', 'Stop', '—', 'Open VISION']);
    expect(labels(trayMenu({ ...focus, paused: true, hasTodo: false }))).toEqual(['Write VSL', 'Resume', '+5 min', 'Stop', '—', 'Open VISION']);
    expect(labels(trayMenu({ ...focus, progress: null }))).toEqual(['Write VSL', 'Pause', 'Done', 'Stop', '—', 'Open VISION']);
  });

  it('asks the check-in, with Not yet choices for a to-do', () => {
    const items = trayMenu({ kind: 'check-in', title: 'Write VSL', hasTodo: true });
    expect(labels(items)).toEqual(["Time's up: Write VSL", 'Done', '+5 min', 'Not yet', '—', 'Open VISION']);
    const notYet = items[3];
    expect(notYet && 'submenu' in notYet ? labels(notYet.submenu ?? []) : []).toEqual(['30 min more', '1 hour more', '2 hours more']);
    expect(labels(trayMenu({ kind: 'check-in', title: 'Focus', hasTodo: false }))).toEqual(["Time's up: Focus", 'Finish', '+5 min', '—', 'Open VISION']);
  });

  it('never changes while only the clocks move, so an open menu stays open', () => {
    const at = (clock: string): Glance => ({ kind: 'meeting', id: 'm', title: 'Call', clock, joinUrl: null, focus: { clock, paused: false } });
    expect(trayMenu(at('4:12'))).toEqual(trayMenu(at('4:11')));
    const focus = (clock: string): Glance => ({ kind: 'focus', title: 'VSL', clock, progress: 0.5, paused: false, hasTodo: true });
    expect(trayMenu(focus('10:00'))).toEqual(trayMenu(focus('9:59')));
  });

  it('puts the meeting first, then the running focus', () => {
    const items = trayMenu({ kind: 'meeting', id: 'm', title: 'Call with Kilo', clock: '4:12', joinUrl: 'https://meet.google.com/x', focus: { clock: '10:00', paused: false } });
    expect(labels(items)).toEqual(['Call with Kilo', 'Join', 'Hide', '—', 'Focus running', 'Pause', 'Stop', '—', 'Open VISION']);
    expect(labels(trayMenu({ kind: 'meeting', id: 'm', title: 'Call', clock: 'Now', joinUrl: null, focus: null }))).toEqual(['Call (now)', 'Hide', '—', 'Open VISION']);
  });
});
