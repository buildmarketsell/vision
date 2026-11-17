import { createElement } from 'react';
import { Shapes } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { openFile } from '../../renderer/core/dockActions';
import { useWorkspace } from '../../renderer/core/workspaceStore';
import { isBoardFile, nextBoardName } from './boardFile';
import { BoardPanel } from './renderer/BoardPanel';

export const BOARD_TAB = 'board';
export const NEW_BOARD_COMMAND = 'board.new';

/** Creates "Untitled board.excalidraw" in the folder's top level and opens it. */
async function createBoard(): Promise<void> {
  const folder = useWorkspace.getState().folder;
  if (!folder) return;
  const listing = await window.vision.fs.listDir(folder);
  const names = listing.ok ? listing.value.map((entry) => entry.name) : [];
  const result = await window.vision.fs.createFile(folder, nextBoardName(names));
  if (result.ok) openFile(result.value);
}

export const boardFeature: Feature = {
  id: 'board',
  name: 'Boards',
  tabTypes: [
    {
      id: BOARD_TAB,
      component: BoardPanel,
      closable: true,
      icon: () => createElement(Shapes, { size: 14, strokeWidth: 1.5, color: 'var(--color-text-muted)', 'aria-hidden': true }),
    },
  ],
  fileHandlers: [{ tabType: BOARD_TAB, matches: isBoardFile }],
  commands: [{ id: NEW_BOARD_COMMAND, title: 'New Board', run: createBoard }],
};
