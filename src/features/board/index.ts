import { createElement } from 'react';
import { Shapes } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { isBoardFile } from './boardFile';
import { createBoard } from './renderer/createBoard';
import { BoardPanel } from './renderer/BoardPanel';
import { BoardsMain } from './renderer/BoardsMain';
import { BoardsView } from './renderer/BoardsView';

export const BOARD_TAB = 'board';
export const NEW_BOARD_COMMAND = 'board.new';

export const boardFeature: Feature = {
  id: 'board',
  name: 'Boards',
  sidebarViews: [{ id: 'boards', title: 'Boards', icon: createElement(Shapes, { size: 15, strokeWidth: 1.5 }), component: BoardsView, main: BoardsMain }],
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
