/**
 * The menu bar item: its text and its menu, worked out from the glance. Pure (no Electron), so it is unit tested;
 * `focusTray.ts` turns it into the real tray.
 */
import { DEFAULT_FOCUS_MINUTES, FOCUS_LENGTHS, MORE_TIME_CHOICES, type FocusAction } from '../../../shared/focus';
import type { Glance } from '../../../shared/glance';

export type TrayRun =
  | { type: 'start'; minutes: number | null }
  | { type: 'focus'; action: FocusAction }
  | { type: 'join' }
  | { type: 'dismiss' }
  | { type: 'open' };

export type TrayItem = { separator: true } | { label: string; run?: TrayRun; submenu?: TrayItem[]; bold?: boolean };

/** Long names would push other menu bar items under the notch, so the title is kept short. */
const TITLE_CHARS = 18;
const short = (text: string) => (text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS - 1).trimEnd()}…` : text);

/** With the island on, the name is already there: the menu bar keeps only the clock, so it takes less room next to the notch. */
export function trayTitle(glance: Glance, withName = true): string {
  const name = (title: string) => (withName ? `  ${short(title)}` : '');
  switch (glance.kind) {
    case 'idle':
      return '';
    case 'focus':
      return `${glance.paused ? 'Paused ' : ''}${glance.clock}${name(glance.title)}`;
    case 'check-in':
      return `Done?${name(glance.title)}`;
    case 'meeting':
      return `${glance.clock}${name(glance.title)}`;
  }
}

const SEPARATOR: TrayItem = { separator: true };
const OPEN: TrayItem = { label: 'Open VISION', run: { type: 'open' } };
const act = (label: string, action: FocusAction): TrayItem => ({ label, run: { type: 'focus', action } });
const moreLabel = (minutes: number) => (minutes < 60 ? `${minutes} min more` : minutes === 60 ? '1 hour more' : `${minutes / 60} hours more`);

function focusControls(paused: boolean, countdown: boolean, hasTodo: boolean): TrayItem[] {
  return [
    paused ? act('Resume', { kind: 'resume' }) : act('Pause', { kind: 'pause' }),
    ...(countdown ? [act('+5 min', { kind: 'add' })] : []),
    ...(hasTodo ? [act('Done', { kind: 'done' })] : []),
    act('Stop', { kind: 'stop' }),
  ];
}

export function trayMenu(glance: Glance): TrayItem[] {
  switch (glance.kind) {
    case 'idle':
      return [
        ...FOCUS_LENGTHS.map((minutes): TrayItem => ({ label: `Focus ${minutes} min`, run: { type: 'start', minutes }, bold: minutes === DEFAULT_FOCUS_MINUTES })),
        { label: 'Stopwatch', run: { type: 'start', minutes: null } },
        SEPARATOR,
        OPEN,
      ];
    case 'focus':
      return [{ label: glance.title }, ...focusControls(glance.paused, glance.progress !== null, glance.hasTodo), SEPARATOR, OPEN];
    case 'check-in':
      return [
        { label: `Time's up: ${glance.title}` },
        act(glance.hasTodo ? 'Done' : 'Finish', { kind: 'done' }),
        act('+5 min', { kind: 'add' }),
        ...(glance.hasTodo ? [{ label: 'Not yet', submenu: MORE_TIME_CHOICES.map((minutes) => act(moreLabel(minutes), { kind: 'not-yet', minutes })) }] : []),
        SEPARATOR,
        OPEN,
      ];
    case 'meeting':
      return [
        // No clocks in the menu: it would change every second, and a rebuilt menu closes under the pointer.
        { label: glance.clock === 'Now' ? `${glance.title} (now)` : glance.title },
        ...(glance.joinUrl ? [{ label: 'Join', run: { type: 'join' } as const, bold: true }] : []),
        { label: 'Hide', run: { type: 'dismiss' } },
        SEPARATOR,
        ...(glance.focus ? [{ label: glance.focus.paused ? 'Focus paused' : 'Focus running' }, glance.focus.paused ? act('Resume', { kind: 'resume' }) : act('Pause', { kind: 'pause' }), act('Stop', { kind: 'stop' }), SEPARATOR] : []),
        OPEN,
      ];
  }
}
