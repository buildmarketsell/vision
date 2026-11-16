import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MAX_INBOX_TEXT } from '../../../shared/inbox';

const MAX_HEIGHT_PX = 120;

/** WhatsApp-style bottom bar: a white rounded field and a round green send button. Enter sends. */
export function InboxComposer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim() !== '';

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="inbox-composer">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        maxLength={MAX_INBOX_TEXT}
        placeholder="Type a message"
        aria-label="Message yourself"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button className="inbox-send" aria-label="Send to inbox" title="Send (Enter)" disabled={!canSend} onClick={send}>
        <SendHorizontal size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
