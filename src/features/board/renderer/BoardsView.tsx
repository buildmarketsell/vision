import { Clock, Folder, FolderOpen, Plus } from 'lucide-react';
import { useActiveViewStore } from '../../../renderer/core/activeView';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { boardFolders, folderIn, nameOf } from '../boardLibrary';
import { useOpenBoard } from './boardSelection';
import { makeBoardFile } from './createBoard';
import { useBoardLibrary } from './useBoardLibrary';
import './boards-view.css';

const ICON = { size: 15, strokeWidth: 1.5 };

/** Sidebar panel for Boards, like Figma's left column: Recents, then every folder that holds boards. */
export function BoardsView() {
  const root = useWorkspace((state) => state.folder);
  const visible = useActiveViewStore((state) => state.stored === 'boards');
  const { boards, error } = useBoardLibrary(root, null, visible);
  const boardOpen = useOpenBoard((state) => state.path !== null);
  const location = useOpenBoard((state) => state.location);
  const { browse, open } = useOpenBoard.getState();
  const current = (place: string) => !boardOpen && (folderIn(root, location) ?? 'recents') === place;
  const newBoard = async () => {
    const path = await makeBoardFile(folderIn(root, location) ?? root);
    if (path) open(path);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">Boards</div>
        <button className="icon-button" title="New board" aria-label="New board" onClick={() => void newBoard()}>
          <Plus {...ICON} />
        </button>
      </div>
      {error && <div className="boards-error" role="alert">{error}</div>}
      <nav aria-label="Boards" className="boards-list">
        <button className="boards-row" aria-current={current('recents')} onClick={() => browse('recents')}>
          <Clock {...ICON} aria-hidden />
          <span className="truncate">Recents</span>
        </button>
        <button className="boards-row" aria-current={current(root)} onClick={() => browse(root)}>
          <FolderOpen {...ICON} aria-hidden />
          <span className="truncate">All folders</span>
        </button>
        {boards && boardFolders(root, boards).length > 0 && <div className="section-label">Folders</div>}
        {boards &&
          boardFolders(root, boards).map((path) => {
            const depth = path.slice(root.length + 1).split('/').length - 1;
            return (
              <button key={path} className="boards-row" title={path} aria-current={current(path)} style={{ paddingLeft: `calc(var(--space-2) + ${depth * 16}px)` }} onClick={() => browse(path)}>
                <Folder {...ICON} aria-hidden />
                <span className="truncate">{nameOf(path)}</span>
              </button>
            );
          })}
      </nav>
    </div>
  );
}
