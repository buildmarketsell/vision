import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, X } from 'lucide-react';
import { useLatest } from '../../../../renderer/core/useLatest';
import type { ChatImage } from '../../../../shared/claudeChat';

export interface QueuedMessage {
  id: number;
  text: string;
  images: ChatImage[];
}

/** Messages written while Claude works wait here and go out one by one when it's free (Kokonut's message queue). */
export function useMessageQueue(ready: boolean, send: (text: string, images: ChatImage[]) => void) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const nextId = useRef(1);
  const sendRef = useLatest(send);

  useEffect(() => {
    const [first, ...rest] = queue;
    if (!ready || !first) return;
    // oxlint-disable-next-line react/set-state-in-effect -- the effect sends to Claude (outside React) the moment it becomes free; removing the sent message must happen in the same step
    setQueue(rest);
    sendRef.current(first.text, first.images);
  }, [ready, queue, sendRef]);

  return {
    queue,
    add: (text: string, images: ChatImage[]) => setQueue((current) => [...current, { id: nextId.current++, text, images }]),
    remove: (id: number) => setQueue((current) => current.filter((item) => item.id !== id)),
  };
}

export function QueuedMessages({ queue, onRemove }: { queue: QueuedMessage[]; onRemove: (id: number) => void }) {
  if (queue.length === 0) return null;
  return (
    <div className="queue" aria-label="Queued messages">
      <div className="caption flex items-center gap-1 px-1">
        <CornerDownLeft size={11} strokeWidth={2} />
        Sends when Claude is done
      </div>
      {queue.map((item, index) => (
        <div key={item.id} className="queue-item enter">
          <span className="caption tabular-nums">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate">{item.text || `${item.images.length} image${item.images.length === 1 ? '' : 's'}`}</span>
          {item.text && item.images.length > 0 && <span className="caption shrink-0">+{item.images.length} image</span>}
          <button className="icon-button" style={{ width: 20, height: 20 }} aria-label={`Remove queued message ${index + 1}`} title="Remove" onClick={() => onRemove(item.id)}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
