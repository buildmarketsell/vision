import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, CheckCheck, Copy, Inbox, Trash2 } from 'lucide-react';
import type { InboxMessage } from '../../../shared/inbox';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { groupByDay, timeLabel } from './inboxFormat';
import { InboxComposer } from './InboxComposer';

const ICON = { size: 15, strokeWidth: 1.5 };

/** The saved messages, kept in sync with every window. Null while loading. `now` is when they last changed, for day labels. */
function useInbox() {
  const [inbox, setInbox] = useState<{ messages: InboxMessage[]; now: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setMessages = (messages: InboxMessage[]) => setInbox({ messages, now: Date.now() });
  useEffect(() => {
    window.vision.inbox.list().then(setMessages, () => setError('Could not load the inbox.'));
    return window.vision.inbox.onChange(setMessages);
  }, []);
  const run = (action: Promise<InboxMessage[]>) => {
    action.then(setMessages, () => setError('That did not save. Try again.'));
  };
  return { messages: inbox?.messages ?? null, now: inbox?.now ?? 0, error, run };
}

function Bubble({ message, tail, onMenu }: { message: InboxMessage; tail: boolean; onMenu: (event: MouseEvent, message: InboxMessage) => void }) {
  return (
    <div className="inbox-row" data-tail={tail}>
      <div className="inbox-bubble enter" data-done={message.done} onContextMenu={(event) => onMenu(event, message)}>
        {tail && (
          <svg className="inbox-tail" viewBox="0 0 8 13" width="8" height="13" aria-hidden>
            <path d="M0 0 H8 L0 11 Z" />
          </svg>
        )}
        <span className="inbox-text">{message.text}</span>
        <span className="inbox-meta">
          {timeLabel(message.createdAt)}
          {message.done ? <Check size={14} strokeWidth={2} aria-label="Done" /> : <CheckCheck size={14} strokeWidth={2} className="inbox-ticks" aria-hidden />}
        </span>
      </div>
    </div>
  );
}

function menuFor(message: InboxMessage, run: (action: Promise<InboxMessage[]>) => void): ContextMenuItem[] {
  return [
    { label: 'Copy', icon: <Copy {...ICON} />, onSelect: () => void navigator.clipboard.writeText(message.text) },
    {
      label: message.done ? 'Mark as not done' : 'Mark as done',
      icon: <Check {...ICON} />,
      onSelect: () => run(window.vision.inbox.setDone(message.id, !message.done)),
    },
    { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => run(window.vision.inbox.remove(message.id)) },
  ];
}

/** Sidebar view: a chat with yourself for notes and reminders, styled like a WhatsApp chat. */
export function InboxView() {
  const { messages, now, error, run } = useInbox();
  const [menu, setMenu] = useState<{ x: number; y: number; message: InboxMessage } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const openMenu = (event: MouseEvent, message: InboxMessage) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, message });
  };

  return (
    <div className="inbox flex min-h-0 flex-1 flex-col">
      <div className="inbox-header">
        <span className="inbox-avatar"><Inbox size={16} strokeWidth={1.75} /></span>
        <div className="min-w-0">
          <div className="font-medium">Inbox</div>
          <div className="inbox-subtitle">Notes to yourself</div>
        </div>
      </div>
      <div ref={listRef} className="inbox-list" aria-label="Inbox messages" role="log">
        {messages === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading inbox" />}
        {messages?.length === 0 && <div className="inbox-chip">Send yourself notes and reminders. They stay on this Mac.</div>}
        {messages &&
          groupByDay(messages, now).map((day) => (
            <div key={day.label} className="flex flex-col gap-0.5">
              <div className="inbox-chip">{day.label}</div>
              {day.messages.map(({ message, tail }) => <Bubble key={message.id} message={message} tail={tail} onMenu={openMenu} />)}
            </div>
          ))}
      </div>
      {error && <div className="inbox-error" role="alert">{error}</div>}
      <InboxComposer onSend={(text) => run(window.vision.inbox.add(text))} />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuFor(menu.message, run)} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** The Inbox filling the window: the same chat, in a centered column so lines stay readable. */
export function InboxPage() {
  return (
    <div className="page-column flex h-full min-h-0 flex-col">
      <InboxView />
    </div>
  );
}
