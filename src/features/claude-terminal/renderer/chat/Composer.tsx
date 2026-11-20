import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square, SquareSlash, X } from 'lucide-react';
import { PERMISSION_MODES, type ChatImage, type EffortLevel, type PermissionMode } from '../../../../shared/claudeChat';
import { ActionsMenu } from './ActionsMenu';
import { MODE_LABELS } from './actions';
import { ComposerMenu } from './ComposerMenu';
import { ContextMeter, ModelPicker } from './ComposerControls';
import type { SessionInfo } from './sessionInfo';
import type { Draft } from './useDraft';
import { useSlashMenu } from './useSlashMenu';

const MAX_HEIGHT_PX = 200;

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
  info: SessionInfo;
  model: string;
  /** Sends now. While Claude works, it reads the message at its next step and fits it into the same job, like Claude Code in VS Code (Dan, 2026-11-20). */
  onSend: (text: string, images: ChatImage[]) => void;
  onStop: () => void;
  onModeChange: (mode: PermissionMode) => void;
  onModelChange: (model: string) => void;
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
}

export function Composer({ draft, working, disabled, mode, info, model, effort, onSend, onStop, onModeChange, onModelChange, onEffortChange }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && (draft.text.trim() !== '' || draft.images.length > 0);
  const slash = useSlashMenu(draft.text, info.commands, draft.setText);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.style.height = 'auto';
    // Hidden behind a menu page it measures 0; keep the natural one-line height instead of shrinking to nothing.
    if (area.scrollHeight > 0) area.style.height = `${Math.min(area.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft.text]);

  const send = () => {
    if (!canSend) return;
    onSend(draft.text, draft.images);
    draft.clear();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slash.onKeyDown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="composer" data-working={working}>
      {/* The neon light running around the box (Settings → Colors). */}
      <span className="neon" aria-hidden>
        <span className="neon-beam" />
      </span>
      {slash.open && <ComposerMenu label="Slash commands" items={slash.items} activeIndex={slash.active} onHover={slash.setActive} onPick={slash.pick} />}
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
      {actionsOpen && (
        <ActionsMenu
          info={info}
          model={model}
          mode={mode}
          effort={effort}
          draft={draft}
          onModelChange={onModelChange}
          onModeChange={onModeChange}
          onEffortChange={onEffortChange}
          onClose={() => {
            setActionsOpen(false);
            ref.current?.focus();
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <button className="composer-pill actions-button" aria-label="Actions" aria-expanded={actionsOpen} title="Actions: attach, model, permissions, commands" onClick={() => setActionsOpen(!actionsOpen)}>
          <SquareSlash size={15} strokeWidth={1.75} />
        </button>
        <select className="composer-pill" aria-label="Permission mode" value={mode} onChange={(event) => onModeChange(event.target.value as PermissionMode)}>
          {PERMISSION_MODES.map((item) => (
            <option key={item} value={item}>{MODE_LABELS[item]}</option>
          ))}
        </select>
        <ModelPicker models={info.models} value={model} onChange={onModelChange} effort={effort} onEffortChange={onEffortChange} />
        <span className="flex-1" />
        <ContextMeter info={info} />
        {working && canSend && (
          <button className="send-button" data-midtask="true" aria-label="Send message" title="Send (Enter): Claude reads it at its next step" onClick={send}>
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        )}
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
