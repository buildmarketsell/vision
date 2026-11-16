import { useState } from 'react';
import { Folder, FolderOpen, X } from 'lucide-react';
import { APP_NAME } from '../../shared/app';
import { baseName } from '../core/workspaceStore';

export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center font-semibold text-white"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: 'var(--color-accent)', fontSize: size * 0.5 }}
    >
      {APP_NAME.charAt(0)}
    </span>
  );
}

function RecentRow({ folder, onRemove }: { folder: string; onRemove: () => void }) {
  return (
    <div className="group row h-11 cursor-pointer" onClick={() => void window.vision.app.openFolder(folder)}>
      <Folder size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{baseName(folder)}</span>
        <span className="truncate text-(--color-text-faint)" style={{ fontSize: 'var(--size-small)' }}>{folder}</span>
      </div>
      <button
        className="icon-button opacity-0 group-hover:opacity-100"
        aria-label={`Remove ${baseName(folder)} from recent folders`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Shown in a window with no folder: open one, or pick a recent one. */
export function Welcome({ recentFolders }: { recentFolders: string[] }) {
  const [recent, setRecent] = useState(recentFolders);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card flex w-full max-w-lg flex-col gap-6 p-8">
        <div className="flex items-center gap-3">
          <AppMark />
          <div>
            <div className="text-lg font-semibold">{APP_NAME}</div>
            <div className="text-(--color-text-muted)">Open a folder to work on it with Claude.</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="button-primary" onClick={() => void window.vision.app.openFolderDialog()}>
            <FolderOpen size={16} strokeWidth={1.75} />
            Open Folder
          </button>
          <span className="text-(--color-text-faint)" style={{ fontSize: 'var(--size-small)' }}>⌘O, or drop a folder on this window</span>
        </div>
        {recent.length > 0 && (
          <div className="flex flex-col">
            <div className="section-label px-2">Recent folders</div>
            <div className="max-h-80 overflow-y-auto">
              {recent.map((folder) => (
                <RecentRow key={folder} folder={folder} onRemove={() => void window.vision.app.removeRecent(folder).then(setRecent)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Shown when the window's folder was moved or deleted while VISION was closed or open. */
export function FolderMissing({ folder }: { folder: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card flex max-w-lg flex-col items-start gap-4 p-8">
        <div className="text-lg font-semibold">This folder was moved or deleted.</div>
        <div className="break-all text-(--color-text-muted)">{folder}</div>
        <button className="button-primary" onClick={() => void window.vision.app.openFolderDialog()}>
          <FolderOpen size={16} strokeWidth={1.75} />
          Open Another Folder
        </button>
      </div>
    </div>
  );
}
