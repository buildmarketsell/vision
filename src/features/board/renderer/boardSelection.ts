import { create } from 'zustand';
import type { BoardsLocation } from '../boardLibrary';

const KEY = 'vision.board';

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

interface OpenBoardState {
  /** The board filling the Boards page; null shows the Boards home. Remembered across launches. */
  path: string | null;
  location: BoardsLocation;
  open: (path: string | null) => void;
  /** Leaves any open board and shows this place on the Boards home. */
  browse: (location: BoardsLocation) => void;
}

function remember(path: string | null): void {
  try {
    if (path) localStorage.setItem(KEY, path);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembering the board is fine; it still opens.
  }
}

export const useOpenBoard = create<OpenBoardState>((set) => ({
  path: readStored(),
  location: 'recents',
  open: (path) => {
    set({ path });
    remember(path);
  },
  browse: (location) => {
    set({ path: null, location });
    remember(null);
  },
}));
