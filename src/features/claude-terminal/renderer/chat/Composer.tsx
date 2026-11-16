import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp, Square, X } from 'lucide-react';
import { PERMISSION_MODES, type ChatImage, type PermissionMode } from '../../../../shared/claudeChat';
import type { Draft } from './useDraft';

const MAX_HEIGHT_PX = 200;

const MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Ask before edits',
  acceptEdits: 'Edit automatically',
  plan: 'Plan first',
};

export function imageUrl(image: ChatImage): string {
  return `data:${image.mediaType};base64,${image.data}`;
}

function Thumbnails({ images, onRemove }: { images: ChatImage[]; onRemove: (index: number) => void }) {
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        <div key={`${index}-${image.data.slice(-16)}`} className="composer-thumb">
          <img src={imageUrl(image)} alt={`Attached image ${index + 1}`} />
          <button aria-label={`Remove image ${index + 1}`} title="Remove" onClick={() => onRemove(index)}>
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface ComposerProps {
  draft: Draft;
  working: boolean;
  disabled: boolean;
  mode: PermissionMode;
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
  onModeChange: (mode: PermissionMode) => void;
}

export function Composer({ draft, working, disabled, mode, onSend, onStop, onModeChange }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && (draft.text.trim() !== '' || draft.images.length > 0);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft.text]);

  const send = () => {
    if (!canSend) return;
    onSend(draft.text, draft.images);
    draft.clear();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="composer">
      <Thumbnails images={draft.images} onRemove={draft.removeImage} />
      <textarea
        ref={ref}
        rows={1}
        value={draft.text}
        placeholder={disabled ? 'Claude is not running' : 'Message Claude… (drop files or paste a screenshot)'}
        aria-label="Message Claude"
        disabled={disabled}
        onChange={(event) => draft.setText(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={draft.onPaste}
      />
      {draft.error && <div className="caption" role="alert" style={{ color: 'var(--color-danger)' }}>{draft.error}</div>}
      <div className="flex items-center gap-2">
        <select className="mode-select" aria-label="Permission mode" value={mode} onChange={(event) => onModeChange(event.target.value as PermissionMode)}>
          {PERMISSION_MODES.map((item) => (
            <option key={item} value={item}>{MODE_LABELS[item]}</option>
          ))}
        </select>
        <span className="flex-1" />
        {working ? (
          <button className="send-button" data-stop="true" aria-label="Stop Claude" title="Stop" onClick={onStop}>
            <Square size={12} strokeWidth={2.5} fill="currentColor" />
          </button>
        ) : (
          <button className="send-button" aria-label="Send message" title="Send (Enter)" disabled={!canSend} onClick={send}>
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}
