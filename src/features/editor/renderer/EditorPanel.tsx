import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { ChevronRight } from 'lucide-react';
import type { TabParams } from '../../../renderer/core/feature';
import { relativeParts, useWorkspace, baseName } from '../../../renderer/core/workspaceStore';
import { reloadFromDisk, useEditor, type Buffer } from './editorStore';

const MonacoEditor = lazy(async () => {
  await import('./monacoSetup');
  return import('./MonacoEditor');
});

function Breadcrumbs({ path }: { path: string }) {
  const folder = useWorkspace((state) => state.folder);
  const parts = [baseName(folder), ...relativeParts(folder, path)];
  return (
    <div className="caption flex h-9 shrink-0 items-center gap-1 overflow-hidden px-4">
      {parts.map((part, index) => (
        <span key={`${index}-${part}`} className="flex min-w-0 items-center gap-1">
          {index > 0 && <ChevronRight size={12} strokeWidth={1.5} color="var(--color-text-faint)" />}
          <span className={`truncate ${index === parts.length - 1 ? 'text-(--color-text)' : ''}`}>{part}</span>
        </span>
      ))}
    </div>
  );
}

function Message({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="title">{title}</div>
      {detail && <div className="max-w-sm text-(--color-text-muted)">{detail}</div>}
      {action}
    </div>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: 'warning' | 'danger' }) {
  const background = tone === 'danger' ? 'var(--color-danger-soft)' : 'var(--color-warning-soft)';
  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-3 py-2" style={{ background, fontSize: 'var(--size-small)' }}>
      {children}
    </div>
  );
}

function DiskBanners({ path, buffer }: { path: string; buffer: Extract<Buffer, { status: 'ready' }> }) {
  const { save, keepMine } = useEditor.getState();
  return (
    <>
      {buffer.disk === 'changed' && (
        <Banner tone="warning">
          <span className="flex-1">This file changed on disk and you have unsaved edits.</span>
          <button className="button-secondary" style={{ height: 26 }} onClick={() => reloadFromDisk(path)}>Load Disk Version</button>
          <button className="button-secondary" style={{ height: 26 }} onClick={() => keepMine(path)}>Keep My Edits</button>
        </Banner>
      )}
      {buffer.disk === 'deleted' && (
        <Banner tone="warning">
          <span className="flex-1">This file was deleted on disk. Save to create it again.</span>
        </Banner>
      )}
      {buffer.saveError && (
        <Banner tone="danger">
          <span className="flex-1">Could not save: {buffer.saveError}</span>
          <button className="button-secondary" style={{ height: 26 }} onClick={() => void save(path)}>Try Again</button>
        </Banner>
      )}
    </>
  );
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EditorBody({ path, buffer }: { path: string; buffer: Buffer | undefined }) {
  if (!buffer || buffer.status === 'loading') return <Message title="Opening…" action={<div className="spinner" />} />;
  if (buffer.status === 'binary') return <Message title="This file can't be shown as text." detail="Images, PDFs and other file types get their own viewers in a later version." />;
  if (buffer.status === 'tooLarge') return <Message title={`This file is too large to edit (${formatSize(buffer.sizeBytes)}).`} detail="Files up to 5 MB open in the editor." />;
  if (buffer.status === 'error') {
    return (
      <Message
        title="This file can't be read."
        detail={buffer.message}
        action={<button className="button-secondary" onClick={() => reloadFromDisk(path)}>Try Again</button>}
      />
    );
  }
  return (
    <div className="flex h-full flex-col">
      <DiskBanners path={path} buffer={buffer} />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<Message title="Loading editor…" action={<div className="spinner" />} />}>
          <MonacoEditor path={path} value={buffer.current} />
        </Suspense>
      </div>
    </div>
  );
}

/** A file tab: breadcrumbs on top, the editor below. */
export function EditorPanel({ params }: IDockviewPanelProps<TabParams>) {
  const path = params.path ?? '';
  const buffer = useEditor((state) => state.buffers[path]);

  useEffect(() => {
    if (path && !useEditor.getState().buffers[path]) void useEditor.getState().load(path);
  }, [path]);

  return (
    <div className="flex h-full flex-col bg-(--color-card)">
      <Breadcrumbs path={path} />
      <div className="min-h-0 flex-1">
        <EditorBody path={path} buffer={buffer} />
      </div>
    </div>
  );
}
