import { useEffect, useState, type MouseEvent } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { X } from 'lucide-react';
import type { TabParams } from './feature';
import { findTabType } from './featureIndex';
import { requestClosePanel } from './dockActions';
import { useTabStatus } from './tabStatus';

/** Notion-style tab: icon and title, a close button on hover, an unsaved dot otherwise. */
export function PanelTab({ api, params, containerApi }: IDockviewPanelHeaderProps<TabParams>) {
  const [title, setTitle] = useState(api.title ?? '');
  const [hovered, setHovered] = useState(false);
  const isDirty = useTabStatus((state) => state.dirtyTabs.has(api.id));
  const tabType = findTabType(api.component);

  useEffect(() => {
    const subscription = api.onDidTitleChange((event) => setTitle(event.title));
    return () => subscription.dispose();
  }, [api]);

  const close = (event: MouseEvent) => {
    event.stopPropagation();
    void requestClosePanel(containerApi.getPanel(api.id));
  };

  const showClose = tabType?.closable !== false && hovered;

  return (
    <div
      className="flex h-full w-full min-w-0 items-center gap-2 px-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onAuxClick={(event) => event.button === 1 && close(event)}
      title={params.path ?? title}
    >
      <span className="flex shrink-0 items-center">{tabType?.icon?.(params)}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="flex w-4 shrink-0 items-center justify-center">
        {showClose && (
          <button className="icon-button" style={{ width: 16, height: 16 }} onClick={close} aria-label={`Close ${title}`}>
            <X size={12} strokeWidth={2} />
          </button>
        )}
        {!showClose && isDirty && <span className="live-dot" style={{ animation: 'none' }} aria-label="Unsaved changes" />}
      </span>
    </div>
  );
}
