import type { InboxMessage } from '../../../shared/inbox';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
/** A new bubble tail after this long a pause, like WhatsApp starting a new run of messages. */
const TAIL_GAP_MS = 5 * 60 * 1000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** "Today", "Yesterday", a weekday within the last week, else "12 Nov 2026". */
export function dayLabel(timestamp: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const date = new Date(timestamp);
  if (days > 1 && days < WEEK_DAYS) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export interface InboxDay {
  label: string;
  messages: Array<{ message: InboxMessage; tail: boolean }>;
}

/** Messages under day chips; the first bubble of each run gets the tail. */
export function groupByDay(messages: InboxMessage[], now: number): InboxDay[] {
  const days: InboxDay[] = [];
  let previous: InboxMessage | null = null;
  for (const message of messages) {
    const label = dayLabel(message.createdAt, now);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, messages: [] };
      days.push(day);
      previous = null;
    }
    const tail = !previous || message.createdAt - previous.createdAt > TAIL_GAP_MS;
    day.messages.push({ message, tail });
    previous = message;
  }
  return days;
}
