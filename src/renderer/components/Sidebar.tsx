import { useState, type PointerEvent } from 'react';
import { FolderOpen, Sparkles } from 'lucide-react';
import { runCommand } from '../core/commands';
import { allSidebarViews } from '../core/featureIndex';
import { baseName, useWorkspace } from '../core/workspaceStore';
import { ErrorBoundary } from './ErrorBoundary';
import { AppMark } from './Welcome';

/** Room for the macOS traffic lights in the top-left corner. */
const TRAFFIC_LIGHTS_WIDTH = 76;

function ResizeHandle() {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = useWorkspace.getState().sidebarWidth;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const onMove = (move: globalThis.PointerEvent) => useWorkspace.getState().setSidebarWidth(startWidth + move.clientX - startX);
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
      style={{ transform: 'translateX(50%)' }}
      onPointerDown={onPointerDown}
    />
  );
}

/** Notion-style sidebar: folder name on top, feature views (Files), "Ask Claude" at the bottom. */
export function Sidebar() {
  const folder = useWorkspace((state) => state.folder);
  const width = useWorkspace((state) => state.sidebarWidth);
  const views = allSidebarViews();
  const [activeId, setActiveId] = useState(views[0]?.id);
  const active = views.find((view) => view.id === activeId) ?? views[0];

  return (
    <aside className="card relative flex shrink-0 flex-col" style={{ width, background: 'var(--color-sidebar)' }}>
      <div className="drag-region flex h-13 shrink-0 items-center gap-2 pr-3" style={{ paddingLeft: TRAFFIC_LIGHTS_WIDTH }}>
        <AppMark size={22} />
        <span className="truncate font-semibold" title={folder}>{baseName(folder)}</span>
      </div>
      {views.length > 1 && (
        <div className="flex gap-1 px-3 pb-1">
          {views.map((view) => (
            <button key={view.id} className="button-secondary" data-active={view.id === active?.id} onClick={() => setActiveId(view.id)}>
              {view.title}
            </button>
          ))}
        </div>
      )}
      {active && (
        <ErrorBoundary name={active.title}>
          <active.component />
        </ErrorBoundary>
      )}
      <div className="flex shrink-0 items-center gap-2 p-3">
        <button
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-(--color-card) font-medium"
          style={{ border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          onClick={() => runCommand('claude.focus')}
        >
          <Sparkles size={15} strokeWidth={1.75} color="var(--color-accent)" />
          Ask Claude
          <span className="rounded px-1 text-(--color-text-faint)" style={{ fontSize: 11, background: 'var(--color-row-hover)' }}>⌘L</span>
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-(--color-card)"
          style={{ border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          title="Open Folder"
          aria-label="Open Folder"
          onClick={() => void window.vision.app.openFolderDialog()}
        >
          <FolderOpen size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
        </button>
      </div>
      <ResizeHandle />
    </aside>
  );
}
