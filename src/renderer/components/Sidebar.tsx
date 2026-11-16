import { useState, type PointerEvent } from 'react';
import { FolderOpen, Sparkles } from 'lucide-react';
import { runCommand } from '../core/commands';
import { allSidebarViews } from '../core/featureIndex';
import { baseName, useWorkspace } from '../core/workspaceStore';
import { theme } from '../theme';
import { ErrorBoundary } from './ErrorBoundary';
import { AppMark } from './Welcome';

/** Room for the macOS traffic lights in the top-left corner. */
const TRAFFIC_LIGHTS_WIDTH = 76;
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
      <button className="pill-button flex-1" onClick={() => runCommand('claude.focus')}>
        <Sparkles size={15} strokeWidth={1.75} color="var(--color-accent)" />
        Ask Claude
        <span className="keycap">⌘L</span>
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

/** Notion-style sidebar: folder name on top, feature sections stacked (Claude, Files), "Ask Claude" at the bottom. */
export function Sidebar() {
  const folder = useWorkspace((state) => state.folder);
  const storedWidth = useWorkspace((state) => state.sidebarWidth);
  const [preview, setPreview] = useState<number | null>(null);
  const views = allSidebarViews();
  const settling = preview === null;

  return (
    <aside
      className="card relative flex shrink-0 flex-col"
      style={{
        width: preview ?? storedWidth,
        background: 'var(--color-sidebar)',
        transition: settling ? 'width var(--duration-base) var(--ease)' : 'none',
        overflow: 'visible',
      }}
    >
      <div className="drag-region flex h-13 shrink-0 items-center gap-2 pr-3" style={{ paddingLeft: TRAFFIC_LIGHTS_WIDTH }}>
        <AppMark size={20} />
        <span className="title truncate" title={folder}>{baseName(folder)}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {views.map((view) => (
          <section key={view.id} aria-label={view.title} className={view.grow ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
            <ErrorBoundary name={view.title}>
              <view.component />
            </ErrorBoundary>
          </section>
        ))}
      </div>
      <BottomBar />
      <ResizeHandle onPreview={setPreview} />
    </aside>
  );
}
