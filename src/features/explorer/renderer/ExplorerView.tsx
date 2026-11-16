import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Eye, EyeOff, FilePlus, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import type { DirEntry } from '../../../shared/ipc';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { parentPath, useWorkspace } from '../../../renderer/core/workspaceStore';
import { trashEntry } from './treeActions';
import { TreeChildren } from './TreeChildren';
import { useTree } from './treeStore';

const REFRESH_DELAY_MS = 120;
const ICON = { size: 15, strokeWidth: 1.5 };

/** Folder that "New File" goes into: the selected folder, the selected file's folder, or the root. */
function targetFolder(root: string, entry: DirEntry | null): string {
  const selected = entry?.path ?? useTree.getState().selected;
  if (!selected) return root;
  const isDir = entry ? entry.isDirectory : useTree.getState().expanded.has(selected) || selected in useTree.getState().listings;
  return isDir ? selected : parentPath(selected);
}

export function startCreate(kind: 'newFile' | 'newDir', entry: DirEntry | null = null): void {
  const folder = targetFolder(useWorkspace.getState().folder, entry);
  if (folder !== useWorkspace.getState().folder) useTree.getState().expand(folder);
  useTree.getState().setEdit({ mode: kind, parent: folder });
}

/** Keeps the tree in sync with changes made outside (Claude, Finder, git). */
function useLiveRefresh(): void {
  useEffect(() => {
    const pending = new Map<string, NodeJS.Timeout>();
    const unsubscribe = window.vision.fs.onChange((change) => {
      const { listings, forget, loadDir } = useTree.getState();
      if (change.kind === 'unlinkDir') forget(change.path);
      const dir = parentPath(change.path);
      if (!listings[dir]) return;
      clearTimeout(pending.get(dir));
      pending.set(dir, setTimeout(() => void loadDir(dir), REFRESH_DELAY_MS));
    });
    return () => {
      unsubscribe();
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);
}

function menuItems(entry: DirEntry | null): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'New File', icon: <FilePlus {...ICON} />, onSelect: () => startCreate('newFile', entry) },
    { label: 'New Folder', icon: <FolderPlus {...ICON} />, onSelect: () => startCreate('newDir', entry) },
  ];
  if (!entry) return items;
  return [
    ...items,
    { label: 'Rename', icon: <Pencil {...ICON} />, onSelect: () => useTree.getState().setEdit({ mode: 'rename', path: entry.path, name: entry.name }) },
    { label: 'Move to Trash', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => void trashEntry(entry.path) },
  ];
}

export function ExplorerView() {
  const folder = useWorkspace((state) => state.folder);
  const showHidden = useWorkspace((state) => state.showHidden);
  const expanded = useTree((state) => state.expanded);
  const notice = useTree((state) => state.notice);
  const [menu, setMenu] = useState<{ x: number; y: number; entry: DirEntry | null } | null>(null);

  useEffect(() => {
    useTree.getState().reset();
    void useTree.getState().loadDir(folder);
  }, [folder]);

  useEffect(() => {
    useWorkspace.getState().setWatched('explorer', [folder, ...expanded]);
  }, [folder, expanded]);

  useLiveRefresh();

  const openMenu = useCallback((event: MouseEvent, entry: DirEntry | null) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, entry });
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="group flex items-center justify-between pr-2">
        <div className="section-label">Files</div>
        <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button className="icon-button" title="New File" aria-label="New File" onClick={() => startCreate('newFile')}>
            <FilePlus {...ICON} />
          </button>
          <button className="icon-button" title="New Folder" aria-label="New Folder" onClick={() => startCreate('newDir')}>
            <FolderPlus {...ICON} />
          </button>
          <button
            className="icon-button"
            title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            onClick={() => useWorkspace.getState().toggleHidden()}
          >
            {showHidden ? <Eye {...ICON} /> : <EyeOff {...ICON} />}
          </button>
        </div>
      </div>
      {notice && (
        <div className="mx-2 mb-1 flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: 'var(--color-danger-soft)', fontSize: 'var(--size-small)' }}>
          <span className="flex-1">{notice}</span>
          <button className="icon-button" style={{ width: 18, height: 18 }} aria-label="Dismiss" onClick={() => useTree.getState().setNotice(null)}>
            <X size={12} />
          </button>
        </div>
      )}
      <div role="tree" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" onContextMenu={(event) => openMenu(event, null)}>
        <TreeChildren dir={folder} depth={0} onContextMenu={openMenu} />
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.entry)} onClose={closeMenu} />}
    </div>
  );
}
