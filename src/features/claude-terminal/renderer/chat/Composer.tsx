import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { PERMISSION_MODES, type PermissionMode } from '../../../../shared/claudeChat';
import { PATH_DRAG_TYPE, relativeParts, useWorkspace } from '../../../../renderer/core/workspaceStore';
const MAX_HEIGHT_PX = 200;

const MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Ask before edits',
  acceptEdits: 'Edit automatically',
  plan: 'Plan first',
};

interface ComposerProps {
  working: boolean;
  disabled: boolean;
  mode: PermissionMode;
  onSend: (text: string) => void;
  onStop: () => void;
  onModeChange: (mode: PermissionMode) => void;
}

export function Composer({ working, disabled, mode, onSend, onStop, onModeChange }: ComposerProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const folder = useWorkspace((state) => state.folder);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const send = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const onDrop = (event: DragEvent) => {
    const path = event.dataTransfer.getData(PATH_DRAG_TYPE);
    if (!path) return;
    event.preventDefault();
    event.stopPropagation();
    const mention = `@${relativeParts(folder, path).join('/')} `;
    setText((current) => (current && !current.endsWith(' ') ? `${current} ${mention}` : current + mention));
    ref.current?.focus();
  };

  return (
    <div
      className="composer"
      onDragOver={(event) => event.dataTransfer.types.includes(PATH_DRAG_TYPE) && event.preventDefault()}
      onDrop={onDrop}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder={disabled ? 'Claude is not running' : 'Message Claude… (drop a file to mention it)'}
        aria-label="Message Claude"
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
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
          <button className="send-button" aria-label="Send message" title="Send (Enter)" disabled={!text.trim() || disabled} onClick={send}>
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}
