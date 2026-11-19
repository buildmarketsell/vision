import { create } from 'zustand';

const KEY = 'vision.board';

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The board shown on the Boards page, remembered across launches. */
export const useOpenBoard = create<{ path: string | null; open: (path: string | null) => void }>((set) => ({
  path: readStored(),
  open: (path) => {
    set({ path });
    try {
      if (path) localStorage.setItem(KEY, path);
      else localStorage.removeItem(KEY);
    } catch {
      // Not remembering the board is fine; it still opens.
    }
  },
}));
