import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { Board } from './BoardPanel';
import { useOpenBoard } from './boardSelection';

/** Boards from the menu: the board picked in the list on the right fills the window. */
export function BoardsMain() {
  const folder = useWorkspace((state) => state.folder);
  const path = useOpenBoard((state) => state.path);
  // A board remembered from another folder doesn't belong here.
  if (!path || !path.startsWith(`${folder}/`)) {
    return <div className="flex h-full items-center justify-center text-(--color-text-muted)">Pick a board on the right, or make a new one with +.</div>;
  }
  return <Board key={path} path={path} />;
}
