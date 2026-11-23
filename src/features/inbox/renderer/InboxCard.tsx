import { useEffect, useState } from 'react';
import type { InboxMessage } from '../../../shared/inbox';

const SHOWN = 5;

/** Dashboard card: the latest notes to yourself that aren't handled yet. */
export function InboxCard() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  useEffect(() => {
    void window.vision.inbox.list().then(setMessages);
    return window.vision.inbox.onChange(setMessages);
  }, []);
  if (!messages) return <div className="caption">Loading…</div>;
  const open = messages.filter((message) => !message.done).slice(-SHOWN).reverse();
  if (open.length === 0) return <div className="caption">Inbox zero.</div>;
  return (
    <div>
      {open.map((message) => (
        <div key={message.id} className="dash-row">
          <span className="min-w-0 flex-1 truncate">{message.text}</span>
          <span className="caption shrink-0">{new Date(message.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}
