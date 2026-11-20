import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { Board } from './BoardPanel';
import { BoardsHome } from './BoardsHome';
import { useOpenBoard } from './boardSelection';

/** Boards from the menu: the open board fills the window; with none open, the Boards home. */
export function BoardsMain() {
  const folder = useWorkspace((state) => state.folder);
  const path = useOpenBoard((state) => state.path);
  // A board remembered from another folder doesn't belong here.
  if (!path || !path.startsWith(`${folder}/`)) return <BoardsHome />;
  return <Board key={path} path={path} />;
}
