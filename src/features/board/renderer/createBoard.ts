import { openFile } from '../../../renderer/core/dockActions';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { nextBoardName } from '../boardFile';

/** Creates "Untitled board.excalidraw" in the folder's top level and opens it. */
export async function createBoard(): Promise<void> {
  const folder = useWorkspace.getState().folder;
  if (!folder) return;
  const listing = await window.vision.fs.listDir(folder);
  const names = listing.ok ? listing.value.map((entry) => entry.name) : [];
  const result = await window.vision.fs.createFile(folder, nextBoardName(names));
  if (result.ok) openFile(result.value);
}
