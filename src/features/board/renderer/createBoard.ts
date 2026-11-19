import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { nextBoardName } from '../boardFile';

/** Creates "Untitled board.excalidraw" in the folder's top level; returns its path, or null if it failed. */
export async function makeBoardFile(): Promise<string | null> {
  const folder = useWorkspace.getState().folder;
  if (!folder) return null;
  const listing = await window.vision.fs.listDir(folder);
  const names = listing.ok ? listing.value.map((entry) => entry.name) : [];
  const result = await window.vision.fs.createFile(folder, nextBoardName(names));
  return result.ok ? result.value : null;
}

/** New Board (Files header, command): creates one and opens it as a tab. */
export async function createBoard(): Promise<void> {
  const path = await makeBoardFile();
  if (path) openFile(path);
}
