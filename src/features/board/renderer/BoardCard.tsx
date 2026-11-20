import { useEffect, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { Folder, MoreHorizontal, Shapes } from 'lucide-react';
import { editedLabel, nameOf } from '../boardLibrary';
import { boardThumbnail, type Thumbnail } from './boardThumbnails';

/** What a card carries while dragged; folders and the breadcrumb take it. */
export const DRAG_TYPE = 'application/x-vision-board-item';

export interface CardActions {
  onOpen: () => void;
  /** Right-click or the "…" button: opens the card's menu at that point. */
  onMenu: (at: { x: number; y: number }) => void;
  /** Something was dropped on this card (folders only). */
  onDropItem?: (path: string) => void;
  renaming: boolean;
  onRename: (name: string | null) => void;
}

function useThumbnail(path: string, modified: number | undefined, dark: boolean): Thumbnail | null {
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  useEffect(() => {
    let current = true;
    void boardThumbnail(path, modified ?? 0, dark).then((made) => current && setThumbnail(made));
    return () => {
      current = false;
    };
  }, [path, modified, dark]);
  return thumbnail;
}

function NameField({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  return (
    <input
      className="board-card-rename"
      aria-label="Name"
      defaultValue={value}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => onDone(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onDone(null);
      }}
    />
  );
}

interface ShellProps extends CardActions {
  path: string;
  kind: 'board' | 'folder';
  preview: ReactNode;
  icon: ReactNode;
  detail: string;
}

/** The card frame shared by boards and folders: preview on top, icon, name and detail below, as in Figma. */
function CardShell({ path, kind, preview, icon, detail, onOpen, onMenu, onDropItem, renaming, onRename }: ShellProps) {
  const [dropping, setDropping] = useState(false);
  const name = nameOf(path);
  const menu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onMenu({ x: event.clientX, y: event.clientY });
  };
  const accepts = (event: DragEvent) => onDropItem !== undefined && event.dataTransfer.types.includes(DRAG_TYPE);
  return (
    <div
      className="board-card"
      data-kind={kind}
      data-dropping={dropping}
      role="listitem"
      draggable={!renaming}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, path);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(event) => {
        setDropping(false);
        const dropped = event.dataTransfer.getData(DRAG_TYPE);
        if (!accepts(event) || !dropped || dropped === path) return;
        event.preventDefault();
        onDropItem?.(dropped);
      }}
      onContextMenu={menu}
    >
      <button className="board-card-open" aria-label={`Open ${name}`} onClick={onOpen} onDoubleClick={onOpen}>
        <div className="board-card-preview">{preview}</div>
      </button>
      <div className="board-card-footer">
        <span className="board-card-icon" data-kind={kind} aria-hidden>
          {icon}
        </span>
        <div className="board-card-text">
          {renaming ? <NameField value={name} onDone={onRename} /> : <div className="board-card-name" title={name}>{name}</div>}
          <div className="board-card-detail">{detail}</div>
        </div>
        <button className="icon-button board-card-more" aria-label={`More for ${name}`} onClick={menu}>
          <MoreHorizontal size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export function BoardCard({ path, modified, dark, ...actions }: CardActions & { path: string; modified: number | undefined; dark: boolean }) {
  const thumbnail = useThumbnail(path, modified, dark);
  const preview =
    thumbnail === null ? (
      <div className="spinner" aria-label="Loading preview" />
    ) : thumbnail.kind === 'image' ? (
      <img src={thumbnail.url} alt="" draggable={false} />
    ) : (
      <span className="board-card-placeholder">{thumbnail.kind === 'empty' ? 'Empty board' : 'No preview'}</span>
    );
  return (
    <CardShell
      {...actions}
      path={path}
      kind="board"
      preview={preview}
      icon={<Shapes size={14} strokeWidth={2} />}
      detail={modified ? editedLabel(modified) : 'Board'}
    />
  );
}

/** One small picture inside a folder card. */
function MiniPreview({ path, modified, dark }: { path: string; modified: number | undefined; dark: boolean }) {
  const thumbnail = useThumbnail(path, modified, dark);
  return <div className="board-folder-tile">{thumbnail?.kind === 'image' && <img src={thumbnail.url} alt="" draggable={false} />}</div>;
}

interface FolderCardProps extends CardActions {
  path: string;
  boardCount: number;
  /** Up to three boards inside, edited last first, shown as small pictures. */
  previews: Array<{ path: string; modified: number | undefined }>;
  dark: boolean;
}

export function FolderCard({ path, boardCount, previews, dark, ...actions }: FolderCardProps) {
  return (
    <CardShell
      {...actions}
      path={path}
      kind="folder"
      preview={
        previews.length === 0 ? (
          <Folder className="board-card-folder-art" size={56} strokeWidth={1.25} />
        ) : (
          <div className="board-folder-tiles">
            {previews.map((board) => (
              <MiniPreview key={board.path} path={board.path} modified={board.modified} dark={dark} />
            ))}
          </div>
        )
      }
      icon={<Folder size={14} strokeWidth={2} />}
      detail={boardCount === 1 ? '1 board' : `${boardCount} boards`}
    />
  );
}
