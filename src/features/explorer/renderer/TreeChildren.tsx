import type { MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DirEntry } from '../../../shared/ipc';
import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { EntryIcon } from '../../../renderer/components/fileIcons';
import { NameInput } from './NameInput';
import { createEntry, renameEntry, trashEntry } from './treeActions';
import { useTree } from './treeStore';

const INDENT_PX = 14;
const BASE_PADDING_PX = 8;

export type OpenMenu = (event: MouseEvent, entry: DirEntry | null) => void;

function indent(depth: number): number {
  return BASE_PADDING_PX + depth * INDENT_PX;
}

interface RowProps {
  entry: DirEntry;
  depth: number;
  onContextMenu: OpenMenu;
}

function TreeRow({ entry, depth, onContextMenu }: RowProps) {
  const isOpen = useTree((state) => state.expanded.has(entry.path));
  const isSelected = useTree((state) => state.selected === entry.path);
  const edit = useTree((state) => state.edit);
  const { select, toggle, setEdit } = useTree.getState();
  const isRenaming = edit?.mode === 'rename' && edit.path === entry.path;

  const activate = () => {
    select(entry.path);
    if (entry.isDirectory) toggle(entry.path);
    else openFile(entry.path);
  };

  return (
    <div
      role="treeitem"
      tabIndex={0}
      aria-expanded={entry.isDirectory ? isOpen : undefined}
      aria-selected={isSelected}
      className="row"
      data-selected={isSelected}
      data-path={entry.path}
      style={{ paddingLeft: indent(depth), opacity: entry.isHidden ? 0.55 : 1 }}
      onClick={activate}
      onContextMenu={(event) => {
        select(entry.path);
        onContextMenu(event, entry);
      }}
      onKeyDown={(event) => {
        if (isRenaming) return;
        if (event.key === 'Enter') setEdit({ mode: 'rename', path: entry.path, name: entry.name });
        if (event.key === 'Backspace' && event.metaKey) void trashEntry(entry.path);
      }}
    >
      <span className="flex w-3 shrink-0 justify-center">
        {entry.isDirectory && (
          <ChevronRight
            size={12}
            strokeWidth={2}
            color="var(--color-text-faint)"
            style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
          />
        )}
      </span>
      <EntryIcon name={entry.name} isDirectory={entry.isDirectory} isOpen={isOpen} />
      {isRenaming ? (
        <NameInput initial={entry.name} onSubmit={(name) => void renameEntry(entry.path, name)} onCancel={() => setEdit(null)} />
      ) : (
        <span className="truncate">{entry.name}</span>
      )}
    </div>
  );
}

function NewEntryRow({ dir, depth, kind }: { dir: string; depth: number; kind: 'newFile' | 'newDir' }) {
  return (
    <div className="row" style={{ paddingLeft: indent(depth) + 12 + 8 }}>
      <EntryIcon name="" isDirectory={kind === 'newDir'} />
      <NameInput initial="" onSubmit={(name) => void createEntry(dir, name, kind)} onCancel={() => useTree.getState().setEdit(null)} />
    </div>
  );
}

interface ChildrenProps {
  dir: string;
  depth: number;
  onContextMenu: OpenMenu;
}

/** The contents of one folder, loaded when it is first expanded. */
export function TreeChildren({ dir, depth, onContextMenu }: ChildrenProps) {
  const listing = useTree((state) => state.listings[dir]);
  const expanded = useTree((state) => state.expanded);
  const edit = useTree((state) => state.edit);
  const showHidden = useWorkspace((state) => state.showHidden);
  const creating = edit && edit.mode !== 'rename' && edit.parent === dir ? edit.mode : null;

  if (!listing || listing.status === 'loading') {
    return (
      <div className="row" style={{ paddingLeft: indent(depth) + 20 }}>
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (listing.status === 'error') {
    return (
      <div className="row" style={{ paddingLeft: indent(depth) + 20, color: 'var(--color-danger)' }}>
        <span className="truncate">{listing.error}</span>
        <button className="button-secondary" style={{ height: 22 }} onClick={() => void useTree.getState().loadDir(dir)}>
          Retry
        </button>
      </div>
    );
  }
  const entries = showHidden ? listing.entries : listing.entries.filter((entry) => !entry.isHidden);
  return (
    <div role="group">
      {creating && <NewEntryRow dir={dir} depth={depth} kind={creating} />}
      {entries.map((entry) => (
        <div key={entry.path}>
          <TreeRow entry={entry} depth={depth} onContextMenu={onContextMenu} />
          {entry.isDirectory && expanded.has(entry.path) && (
            <TreeChildren dir={entry.path} depth={depth + 1} onContextMenu={onContextMenu} />
          )}
        </div>
      ))}
      {entries.length === 0 && !creating && depth === 0 && (
        <div className="px-3 py-2 text-(--color-text-faint)">This folder is empty.</div>
      )}
    </div>
  );
}
