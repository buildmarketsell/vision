import { useState } from 'react';
import { ChevronRight, Copy, Folder, FolderInput, FolderPlus, Home, Pencil, Plus, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { isBoardFile } from '../boardFile';
import { boardFolders, breadcrumb, folderView, nameOf, recentBoards } from '../boardLibrary';
import { BoardCard, DRAG_TYPE, FolderCard } from './BoardCard';
import { useOpenBoard } from './boardSelection';
import { makeBoardFile } from './createBoard';
import { duplicateBoard, moveItem, newFolder, renameItem, trashItem } from './libraryActions';
import { libraryChanged, useBoardLibrary } from './useBoardLibrary';
import './boards-home.css';

const ICON = { size: 15, strokeWidth: 1.75 };

interface Menu {
  at: { x: number; y: number };
  items: ContextMenuItem[];
}

/** The Boards page when no board is open, like Figma's file browser: Recents or one folder, as cards. */
export function BoardsHome() {
  const root = useWorkspace((state) => state.folder);
  const location = useOpenBoard((state) => state.location);
  const { open, browse } = useOpenBoard.getState();
  const folder = location === 'recents' ? null : location;
  const library = useBoardLibrary(root, folder, true);
  const dark = useAppTheme((state) => state.active.scheme) === 'dark';
  const [menu, setMenu] = useState<Menu | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const boards = library.boards ?? [];
  const view = folder ? folderView(folder, boards, library.emptyFolders) : { folders: [], boards: recentBoards(boards, library.times) };
  const here = folder ?? root;

  /** Runs a change, shows its error if any, and lists the boards again. */
  const run = async (change: Promise<string | null>) => {
    setNotice(await change);
    libraryChanged();
  };

  const newBoard = async () => {
    const path = await makeBoardFile(here);
    if (path) open(path);
    else setNotice('The board could not be created.');
  };

  const addFolder = async () => {
    const made = await newFolder(here);
    if (!made.ok) return setNotice(made.error);
    libraryChanged();
    setRenaming(made.value);
  };

  const moveMenu = (path: string, isBoard: boolean, at: Menu['at']) => {
    const targets = [root, ...boardFolders(root, boards), ...library.emptyFolders].filter(
      (target, index, all) => all.indexOf(target) === index && target !== path && !target.startsWith(`${path}/`) && target !== path.slice(0, path.lastIndexOf('/')),
    );
    setMenu({
      at,
      items: targets.map((target) => ({
        label: target === root ? nameOf(root) : target.slice(root.length + 1).split('/').join(' / '),
        icon: target === root ? <Home {...ICON} /> : <Folder {...ICON} />,
        onSelect: () => void run(moveItem(path, target, isBoard)),
      })),
    });
  };

  const itemMenu = (path: string, isBoard: boolean, at: Menu['at']) =>
    setMenu({
      at,
      items: [
        { label: 'Open', icon: <SquareArrowOutUpRight {...ICON} />, onSelect: () => (isBoard ? open(path) : browse(path)) },
        { label: 'Rename', icon: <Pencil {...ICON} />, onSelect: () => setRenaming(path) },
        ...(isBoard ? [{ label: 'Duplicate', icon: <Copy {...ICON} />, onSelect: () => void run(duplicateBoard(path).then((made) => (made.ok ? null : made.error))) }] : []),
        { label: 'Move to…', icon: <FolderInput {...ICON} />, onSelect: () => moveMenu(path, isBoard, at) },
        { label: 'Move to Trash', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => void run(trashItem(path)) },
      ],
    });

  const cardActions = (path: string, isBoard: boolean) => ({
    onOpen: () => (isBoard ? open(path) : browse(path)),
    onMenu: (at: Menu['at']) => itemMenu(path, isBoard, at),
    renaming: renaming === path,
    onRename: (name: string | null) => {
      setRenaming(null);
      if (name !== null) void run(renameItem(path, name, isBoard));
    },
    onDropItem: isBoard ? undefined : (dropped: string) => void run(moveItem(dropped, path, isBoardFile(dropped))),
  });

  const empty = library.boards !== null && view.folders.length === 0 && view.boards.length === 0;

  return (
    <div className="boards-home h-full overflow-y-auto">
      <div className="page-column" data-width="wide">
        <div className="segmented boards-home-switch" role="radiogroup" aria-label="Show">
          <button role="radio" aria-checked={folder === null} data-active={folder === null} onClick={() => browse('recents')}>
            Recents
          </button>
          <button role="radio" aria-checked={folder !== null} data-active={folder !== null} onClick={() => browse(root)}>
            Folders
          </button>
        </div>
        {folder && <Breadcrumb root={root} folder={folder} onDropItem={(dropped, target) => void run(moveItem(dropped, target, isBoardFile(dropped)))} />}
        <div className="boards-home-header">
          <h1 className="page-title">{folder ? nameOf(folder) : 'Recents'}</h1>
          <div className="boards-home-actions">
            {folder && (
              <button className="button-secondary" onClick={() => void addFolder()}>
                <FolderPlus {...ICON} /> New folder
              </button>
            )}
            <button className="button-primary" onClick={() => void newBoard()}>
              <Plus {...ICON} /> New board
            </button>
          </div>
        </div>
        {(notice ?? library.error) && (
          <div className="boards-home-notice" role="alert">
            {notice ?? library.error}
          </div>
        )}
        {library.boards === null && <div className="spinner mx-auto mt-12" aria-label="Loading boards" />}
        {empty && <p className="boards-home-empty">{folder ? 'This folder is empty. Drag boards onto it, or make a new one.' : 'No boards yet. Make your first one with New board.'}</p>}
        <div className="boards-grid" role="list" aria-label={folder ? `Boards in ${nameOf(folder)}` : 'Recent boards'}>
          {view.folders.map((item) => (
            <FolderCard
              key={item.path}
              path={item.path}
              boardCount={item.boardCount}
              previews={recentBoards(boards.filter((board) => board.startsWith(`${item.path}/`)), library.times)
                .slice(0, 3)
                .map((board) => ({ path: board, modified: library.times[board] }))}
              dark={dark}
              {...cardActions(item.path, false)}
            />
          ))}
          {view.boards.map((path) => (
            <BoardCard key={path} path={path} modified={library.times[path]} dark={dark} {...cardActions(path, true)} />
          ))}
        </div>
      </div>
      {menu && <ContextMenu x={menu.at.x} y={menu.at.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

/** "BUSINESS OS › ideas › reels": each step opens that folder and takes dropped boards. */
function Breadcrumb({ root, folder, onDropItem }: { root: string; folder: string; onDropItem: (dropped: string, target: string) => void }) {
  const { browse } = useOpenBoard.getState();
  const trail = breadcrumb(root, folder);
  return (
    <nav className="boards-breadcrumb" aria-label="Folder path">
      {trail.slice(0, -1).map((path) => (
        <span key={path} className="boards-breadcrumb-step">
          <button
            onClick={() => browse(path)}
            onDragOver={(event) => event.dataTransfer.types.includes(DRAG_TYPE) && event.preventDefault()}
            onDrop={(event) => {
              const dropped = event.dataTransfer.getData(DRAG_TYPE);
              if (dropped) onDropItem(dropped, path);
            }}
          >
            {nameOf(path)}
          </button>
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
        </span>
      ))}
    </nav>
  );
}
