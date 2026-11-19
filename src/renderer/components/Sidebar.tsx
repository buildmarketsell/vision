import { useState, type PointerEvent } from 'react';
import { FolderOpen, PanelLeft } from 'lucide-react';
import { ClaudeLogo } from './ClaudeLogo';
import { runCommand } from '../core/commands';
import { allSidebarViews } from '../core/featureIndex';
import { baseName, useWorkspace } from '../core/workspaceStore';
import { theme } from '../theme';
import { useActiveView, ViewPanels, ViewSwitcher } from './SidebarViews';

const RUBBER_BAND = 0.55;

/** Past a limit the sidebar keeps following the pointer, but with growing resistance. */
export function rubberBand(overshoot: number, dimension: number): number {
  return (overshoot * dimension * RUBBER_BAND) / (dimension + RUBBER_BAND * Math.abs(overshoot));
}

function previewWidth(raw: number): number {
  const { sidebarMinWidth: min, sidebarMaxWidth: max } = theme.layout;
  if (raw > max) return max + rubberBand(raw - max, max);
  if (raw < min) return min - rubberBand(min - raw, min);
  return raw;
}

/** Drag to resize, 1:1 with the pointer; past the limits it stretches, then springs back. */
function ResizeHandle({ onPreview }: { onPreview: (width: number | null) => void }) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = useWorkspace.getState().sidebarWidth;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let raw = startWidth;
    const onMove = (move: globalThis.PointerEvent) => {
      raw = startWidth + move.clientX - startX;
      onPreview(previewWidth(raw));
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      useWorkspace.getState().setSidebarWidth(raw);
      onPreview(null);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      className="absolute top-0 right-0 z-10 h-full w-3 cursor-col-resize"
      style={{ transform: 'translateX(50%)' }}
      onPointerDown={onPointerDown}
    />
  );
}

function BottomBar() {
  return (
    <div className="flex shrink-0 items-center gap-2 p-3">
      <button className="pill-button flex-1" aria-label="Open a new Claude terminal" title="Open a new Claude terminal (⌘T)" onClick={() => runCommand('claude.new')}>
        <ClaudeLogo size={16} />
        Claude
        <span className="keycap">⌘T</span>
      </button>
      <button
        className="pill-button w-9"
        title="Open Folder (⌘O)"
        aria-label="Open Folder"
        onClick={() => void window.vision.app.openFolderDialog()}
      >
        <FolderOpen size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
      </button>
    </div>
  );
}

/** Notion's sidebar button: sits right of the traffic lights and stays put whether the sidebar is open or hidden (⌘\\). */
export function SidebarToggle() {
  const collapsed = useWorkspace((state) => state.sidebarCollapsed);
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar';
  return (
    <button
      className="icon-button sidebar-toggle no-drag"
      title={`${label} (⌘\\)`}
      aria-label={label}
      aria-expanded={!collapsed}
      onClick={() => useWorkspace.getState().toggleSidebar()}
    >
      <PanelLeft size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
    </button>
  );
}

/** Notion-style sidebar, flush left: traffic lights and folder name on top, view icons, the active view, a Claude button at the bottom. */
export function Sidebar() {
  const folder = useWorkspace((state) => state.folder);
  const storedWidth = useWorkspace((state) => state.sidebarWidth);
  const collapsed = useWorkspace((state) => state.sidebarCollapsed);
  const [preview, setPreview] = useState<number | null>(null);
  const views = allSidebarViews();
  const [activeView, selectView] = useActiveView(views);
  const settling = preview === null;

  return (
    <aside
      className="sidebar relative flex shrink-0 flex-col overflow-hidden"
      inert={collapsed}
      aria-hidden={collapsed}
      style={{
        width: collapsed ? 0 : (preview ?? storedWidth),
        transition: settling ? 'width var(--duration-base) var(--ease)' : 'none',
      }}
    >
      <div className="drag-region flex h-(--title-bar-height) shrink-0 items-center gap-2 pr-3 pl-(--title-bar-inset)">
        <span className="title truncate" title={folder}>{baseName(folder)}</span>
      </div>
      <ViewSwitcher views={views} active={activeView} onSelect={selectView} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ViewPanels views={views} active={activeView} />
      </div>
      {!views.find((view) => view.id === activeView)?.ownBottomBar && <BottomBar />}
      {!collapsed && <ResizeHandle onPreview={setPreview} />}
    </aside>
  );
}
