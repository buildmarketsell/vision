import { createPortal } from 'react-dom';
import { useState, type PointerEvent } from 'react';
import { FolderOpen, PanelRight } from 'lucide-react';
import { ClaudeLogo } from './ClaudeLogo';
import { runCommand } from '../core/commands';
import { allSidebarViews } from '../core/featureIndex';
import { baseName, useWorkspace } from '../core/workspaceStore';
import { theme } from '../theme';
import { usePeek } from '../core/usePeek';
import { useActiveView, ViewPanels } from './SidebarViews';

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

/** Drag its left edge to resize, 1:1 with the pointer; past the limits it stretches, then springs back. */
function ResizeHandle({ onPreview }: { onPreview: (width: number | null) => void }) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = useWorkspace.getState().sidebarWidth;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let raw = startWidth;
    const onMove = (move: globalThis.PointerEvent) => {
      raw = startWidth - (move.clientX - startX);
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
      className="absolute top-0 left-0 z-10 h-full w-3 cursor-col-resize"
      style={{ transform: 'translateX(-50%)' }}
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
      {/*
        Last in the page: the window's drag areas are applied in page order, so a draggable top row that
        comes later (a page's top bar) would swallow clicks on a button placed before it.
      */}
      {createPortal(
        <button
          className="pill-button w-9"
          title="Open Folder (⌘O)"
          aria-label="Open Folder"
          onClick={() => void window.vision.app.openFolderDialog()}
        >
          <FolderOpen size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
        </button>,
        document.body,
      )}
    </div>
  );
}

/** The open feature's panel (files, to-dos, calendar…), flush right. Hidden with its button or ⌘⇧\; then hovering the right edge slides it out. */
export function Sidebar() {
  const folder = useWorkspace((state) => state.folder);
  const storedWidth = useWorkspace((state) => state.sidebarWidth);
  const collapsed = useWorkspace((state) => state.sidebarCollapsed);
  const [preview, setPreview] = useState<number | null>(null);
  const views = allSidebarViews();
  const [activeView] = useActiveView(views);
  const peek = usePeek(collapsed);
  const label = collapsed ? 'Show sidebar' : 'Hide sidebar';
  // Pages like To-do and Settings fill the window alone; the panels stay mounted so the file tree keeps its open folders.
  const hasPanel = Boolean(views.find((view) => view.id === activeView)?.component);

  return (
    <>
      {collapsed && hasPanel && <div className="edge-zone" data-side="right" aria-hidden onPointerEnter={peek.show} onPointerLeave={peek.hideSoon} />}
      <aside
        className="sidebar side-panel"
        data-side="right"
        data-collapsed={collapsed}
        data-peeking={peek.peeking}
        aria-label="Sidebar"
        hidden={!hasPanel}
        inert={collapsed && !peek.peeking}
        style={{ width: preview ?? storedWidth, transition: preview === null ? undefined : 'none' }}
        onPointerEnter={peek.show}
        onPointerLeave={peek.hideSoon}
      >
        <div className="side-panel-top drag-region flex h-(--title-bar-height) shrink-0 items-center gap-2 pr-11 pl-3">
          <span className="title truncate" title={folder}>{baseName(folder)}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ViewPanels views={views} active={activeView} />
        </div>
        {!views.find((view) => view.id === activeView)?.ownBottomBar && <BottomBar />}
        {!collapsed && <ResizeHandle onPreview={setPreview} />}
      </aside>
      <button
        hidden={!hasPanel}
        className="icon-button panel-toggle no-drag"
        data-side="right"
        title={`${label} (⌘⇧\\)`}
        aria-label={label}
        aria-expanded={!collapsed}
        onClick={() => {
          peek.hide();
          useWorkspace.getState().toggleSidebar();
        }}
        onPointerEnter={peek.show}
        onPointerLeave={peek.hideSoon}
      >
        <PanelRight size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
      </button>
    </>
  );
}
