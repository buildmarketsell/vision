import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Shapes } from 'lucide-react';
import { useActiveViewStore } from '../../../renderer/core/activeView';
import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { BOARD_EXTENSION, boardLabel } from '../boardFile';
import { createBoard } from './createBoard';
import './boards-view.css';

const ICON = { size: 15, strokeWidth: 1.5 };

/** Every board in the folder, found again whenever the view is opened or a board changes on disk. */
function useBoards(folder: string, visible: boolean) {
  const [boards, setBoards] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      window.vision.fs.findFiles(folder, BOARD_EXTENSION).then((result) => {
        setBoards(result.ok ? result.value : null);
        setError(result.ok ? null : `Boards could not be listed: ${result.error}`);
      }),
    [folder],
  );
  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);
  useEffect(
    () =>
      window.vision.fs.onChange((change) => {
        if (change.path.toLowerCase().endsWith(BOARD_EXTENSION)) void load();
      }),
    [load],
  );
  return { boards, error, load };
}

/** Sidebar panel for Boards: one row per `.excalidraw` file in the folder, and New board. */
export function BoardsView() {
  const folder = useWorkspace((state) => state.folder);
  const visible = useActiveViewStore((state) => state.stored === 'boards');
  const { boards, error, load } = useBoards(folder, visible);
  const newBoard = async () => {
    await createBoard();
    await load();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">Boards</div>
        <div className="flex items-center">
          <button className="icon-button" title="New board" aria-label="New board" onClick={() => void newBoard()}>
            <Plus {...ICON} />
          </button>
          <button className="icon-button" title="Refresh" aria-label="Refresh boards" onClick={() => void load()}>
            <RefreshCw {...ICON} />
          </button>
        </div>
      </div>
      {error && <div className="boards-error" role="alert">{error}</div>}
      {boards === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading boards" />}
      <ul aria-label="Boards" className="boards-list">
        {boards?.map((path) => (
          <li key={path}>
            <button className="boards-row" title={path} onClick={() => openFile(path)}>
              <Shapes {...ICON} aria-hidden />
              <span className="truncate">{boardLabel(folder, path)}</span>
            </button>
          </li>
        ))}
      </ul>
      {boards?.length === 0 && (
        <button className="boards-empty" onClick={() => void newBoard()}>
          No boards yet. Create one
        </button>
      )}
    </div>
  );
}
