import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { ChevronsDownUp, Eye, EyeOff, FilePlus, FolderPlus, Pencil, RefreshCw, Shapes, Trash2, X, type LucideIcon } from 'lucide-react';
import type { DirEntry } from '../../../shared/ipc';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { runCommand } from '../../../renderer/core/commands';
import { baseName, parentPath, useWorkspace } from '../../../renderer/core/workspaceStore';
import { trashEntry } from './treeActions';
import { TreeChildren } from './TreeChildren';
import { useTree } from './treeStore';

const REFRESH_DELAY_MS = 120;
const ICON = { size: 15, strokeWidth: 1.5 };
const HEADER_BUTTON_SIZE = 24;


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

function HeaderButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button className="icon-button" style={{ width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE }} title={label} aria-label={label} onClick={onClick}>
      <Icon {...ICON} />
    </button>
  );
}

function ExplorerHeader({ folder, showHidden }: { folder: string; showHidden: boolean }) {
  const hiddenLabel = showHidden ? 'Hide hidden files' : 'Show hidden files';
  return (
    <div className="flex items-center justify-between gap-2 pr-2 pl-3">
      <div className="title min-w-0 truncate" title={folder}>{baseName(folder)}</div>
      <div className="flex items-center">
        <HeaderButton label="New File" icon={FilePlus} onClick={() => startCreate('newFile')} />
        <HeaderButton label="New Folder" icon={FolderPlus} onClick={() => startCreate('newDir')} />
        <HeaderButton label="New Board" icon={Shapes} onClick={() => runCommand('board.new')} />
        <HeaderButton label="Refresh" icon={RefreshCw} onClick={() => void useTree.getState().refresh(folder)} />
        <HeaderButton label="Collapse All" icon={ChevronsDownUp} onClick={() => useTree.getState().collapseAll()} />
        <HeaderButton label={hiddenLabel} icon={showHidden ? Eye : EyeOff} onClick={() => useWorkspace.getState().toggleHidden()} />
      </div>
    </div>
  );
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
      <ExplorerHeader folder={folder} showHidden={showHidden} />
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
