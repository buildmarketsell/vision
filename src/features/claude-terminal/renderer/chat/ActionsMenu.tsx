import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { EffortLevel, PermissionMode } from '../../../../shared/claudeChat';
import { runCommand } from '../../../../renderer/core/commands';
import { buildActions, filterActions, type ActionItem } from './actions';
import { EffortControl } from './ComposerControls';
import type { SessionInfo } from '../../../../shared/chat/sessionInfo';
import type { Draft } from './useDraft';

interface ActionsMenuProps {
  info: SessionInfo;
  model: string;
  mode: PermissionMode;
  effort: EffortLevel;
  draft: Draft;
  onModelChange: (model: string) => void;
  onModeChange: (mode: PermissionMode) => void;
  onEffortChange: (effort: EffortLevel) => void;
  onClose: () => void;
}

/** The "/" button's menu: filter box on top, then Context, Model, Permissions and Slash commands, like Claude Code in VS Code. */
export function ActionsMenu({ info, model, mode, effort, draft, onModelChange, onModeChange, onEffortChange, onClose }: ActionsMenuProps) {
  const [query, setQuery] = useState('');
  const [picked, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const items = filterActions(buildActions(info, model, mode), query);
  const active = Math.min(picked, Math.max(0, items.length - 1));
  const supportsEffort = info.models.find((option) => option.value === model)?.supportsEffort ?? false;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !(event.target as Element).closest('.actions-button')) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: ActionItem) => {
    const { action } = item;
    if (action.kind === 'attachImage') return imageInput.current?.click();
    if (action.kind === 'mentionFile') return fileInput.current?.click();
    if (action.kind === 'newChat') runCommand('claude.new');
    if (action.kind === 'model') onModelChange(action.value);
    if (action.kind === 'mode') onModeChange(action.value);
    if (action.kind === 'command') draft.setText(`/${action.name} `);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step && items.length > 0) setActive((active + step + items.length) % items.length);
    else if (event.key === 'Enter' && items[active]) run(items[active]);
    else if (event.key === 'Escape') onClose();
    else return;
    event.preventDefault();
  };

  const filesPicked = (files: FileList | null, mentionOnly: boolean) => {
    if (files?.length) draft.addFiles([...files], mentionOnly);
    onClose();
  };

  return (
    <div ref={rootRef} className="composer-menu actions-menu" role="dialog" aria-label="Actions">
      <input
        className="actions-filter"
        autoFocus
        value={query}
        placeholder="Filter actions…"
        aria-label="Filter actions"
        aria-controls="actions-list"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div id="actions-list" role="listbox" aria-label="Actions" className="actions-list">
        {items.length === 0 && <div className="caption px-3 py-2">No action matches “{query}”.</div>}
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {item.section !== items[index - 1]?.section && <div className="actions-section">{item.section}</div>}
            <div role="option" aria-selected={index === active} data-active={index === active} className="composer-menu-item" onMouseMove={() => setActive(index)} onClick={() => run(item)}>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.detail && <span className="caption min-w-0 truncate">{item.detail}</span>}
              {item.checked && <Check size={14} strokeWidth={2} color="var(--color-accent)" />}
            </div>
            {supportsEffort && item.section === 'Model' && items[index + 1]?.section !== 'Model' && <EffortControl effort={effort} onChange={onEffortChange} />}
          </Fragment>
        ))}
      </div>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(event) => filesPicked(event.target.files, false)} />
      <input ref={fileInput} type="file" multiple hidden onChange={(event) => filesPicked(event.target.files, true)} />
    </div>
  );
}
