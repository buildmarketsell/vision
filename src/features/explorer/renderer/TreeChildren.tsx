import type { CSSProperties, MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DirEntry } from '../../../shared/ipc';
import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { startTreeDrag } from '../../../renderer/core/treeDrag';
import { EntryIcon } from '../../../renderer/components/fileIcons';
import { NameInput } from './NameInput';
import { createEntry, renameEntry, trashEntry } from './treeActions';
import { useTree } from './treeStore';
import './file-tree.css';

const INDENT_PX = 14;
const BASE_PADDING_PX = 8;
/** Half the chevron column: the indent guide runs under the parent's chevron. */
const CHEVRON_CENTER_PX = 6;
/** New rows fade in one after another, 25 ms apart, never more than 100 ms late (beui's file tree). */
const STAGGER_MS = 25;
const MAX_STAGGER_MS = 100;

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
  const isSelected = useTree((state) => state.picked.includes(entry.path));
  const edit = useTree((state) => state.edit);
  const { select, toggle, togglePicked, setEdit } = useTree.getState();
  const isRenaming = edit?.mode === 'rename' && edit.path === entry.path;

  const activate = (event: MouseEvent) => {
    if (event.metaKey) {
      togglePicked(entry.path);
      return;
    }
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
      draggable
      onDragStart={(event) => {
        // A real file drag, so Finder and Google Drive take the files; several if this row is one of the ⌘-picked ones.
        event.preventDefault();
        const { picked } = useTree.getState();
        if (!picked.includes(entry.path)) select(entry.path);
        startTreeDrag(picked.includes(entry.path) ? picked : [entry.path]);
      }}
      style={{ paddingLeft: indent(depth), opacity: entry.isHidden ? 0.55 : 1 }}
      onClick={activate}
      onContextMenu={(event) => {
        if (!useTree.getState().picked.includes(entry.path)) select(entry.path);
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
            className="chevron"
            size={12}
            strokeWidth={2}
            color="var(--color-text-faint)"
            style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
          />
        )}
      </span>
      {/* Keyed so the folder icon swaps with a small turn when it opens or closes. */}
      <span key={isOpen ? 'open' : 'closed'} className="tree-icon" data-open={entry.isDirectory ? isOpen : undefined}>
        <EntryIcon name={entry.name} isDirectory={entry.isDirectory} isOpen={isOpen} />
      </span>
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
    <div role="group" className={depth > 0 ? 'tree-group' : undefined} style={{ '--guide-left': `${indent(depth - 1) + CHEVRON_CENTER_PX}px` } as CSSProperties}>
      {creating && <NewEntryRow dir={dir} depth={depth} kind={creating} />}
      {entries.map((entry, index) => (
        <div key={entry.path} className="tree-enter" style={{ animationDelay: `${Math.min((index + 1) * STAGGER_MS, MAX_STAGGER_MS)}ms` }}>
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
