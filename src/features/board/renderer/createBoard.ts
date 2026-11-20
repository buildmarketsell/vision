import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { nextBoardName } from '../boardFile';

/** Creates "Untitled board.excalidraw" in `dir` (default: the folder's top level); returns its path, or null if it failed. */
export async function makeBoardFile(dir = useWorkspace.getState().folder): Promise<string | null> {
  if (!dir) return null;
  const listing = await window.vision.fs.listDir(dir);
  const names = listing.ok ? listing.value.map((entry) => entry.name) : [];
  const result = await window.vision.fs.createFile(dir, nextBoardName(names));
  return result.ok ? result.value : null;
}

/** New Board (Files header, command): creates one and opens it as a tab. */
export async function createBoard(): Promise<void> {
  const path = await makeBoardFile();
  if (path) openFile(path);
}
