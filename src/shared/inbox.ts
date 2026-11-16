/** Inbox: notes Dan sends to himself, like a chat with yourself. Saved app-wide, not per folder. */

export interface InboxMessage {
  id: string;
  text: string;
  /** Milliseconds since 1970. */
  createdAt: number;
  /** Ticked off as handled (shown crossed out). */
  done: boolean;
}

export const MAX_INBOX_TEXT = 10_000;
export const MAX_INBOX_MESSAGES = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keeps only well-formed messages from the saved file, oldest first. */
export function normalizeInbox(raw: unknown): InboxMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages = raw.flatMap((item): InboxMessage[] => {
    if (!isRecord(item)) return [];
    const { id, text, createdAt, done } = item;
    if (typeof id !== 'string' || typeof text !== 'string' || typeof createdAt !== 'number') return [];
    return [{ id, text: text.slice(0, MAX_INBOX_TEXT), createdAt, done: done === true }];
  });
  return messages.sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_INBOX_MESSAGES);
}

/** The text to save, or null if there's nothing to send. */
export function cleanInboxText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed && trimmed.length <= MAX_INBOX_TEXT ? trimmed : null;
}
