import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { BOARD_EXTENSION, isBoardFile } from '../boardFile';

export interface BoardLibrary {
  /** Every board in the folder; null while loading. */
  boards: string[] | null;
  /** Last-edit time per board. */
  times: Record<string, number>;
  /** Empty folders in the place being shown, so a just-made folder appears at once. */
  emptyFolders: string[];
  error: string | null;
  /** The folder being shown can't be read any more. */
  locationMissing: boolean;
  reload: () => Promise<void>;
}

/** Bumped after VISION itself adds, renames or moves boards, so every list of them (home, sidebar) reloads. */
const useLibraryVersion = create<{ version: number }>(() => ({ version: 0 }));

export function libraryChanged(): void {
  useLibraryVersion.setState((state) => ({ version: state.version + 1 }));
}

/** Empty sub-folders of `location`, or null when `location` itself can't be read (renamed, deleted, elsewhere). */
async function emptySubfolders(location: string): Promise<string[] | null> {
  const listing = await window.vision.fs.listDir(location);
  if (!listing.ok) return null;
  const folders = listing.value.filter((entry) => entry.isDirectory && !entry.isHidden);
  const empty = await Promise.all(
    folders.map(async (folder) => {
      const inside = await window.vision.fs.listDir(folder.path);
      return inside.ok && inside.value.every((entry) => entry.isHidden) ? folder.path : null;
    }),
  );
  return empty.filter((path): path is string => path !== null);
}

/** The boards in `root`, found again whenever a board or folder changes on disk. `location` is a folder path or null (Recents). */
export function useBoardLibrary(root: string, location: string | null, active: boolean): BoardLibrary {
  const [boards, setBoards] = useState<string[] | null>(null);
  const [times, setTimes] = useState<Record<string, number>>({});
  const [emptyFolders, setEmptyFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [locationMissing, setLocationMissing] = useState(false);
  // Several reloads can be in flight (a move, the watcher, a click into a folder): only the newest one counts.
  const latest = useRef(0);

  const reload = useCallback(
    () => {
      const request = ++latest.current;
      return window.vision.fs.findFiles(root, BOARD_EXTENSION).then(async (found) => {
        if (request !== latest.current) return;
        if (!found.ok) {
          setError(`Boards could not be listed: ${found.error}`);
          setBoards([]);
          return;
        }
        const [modified, empty] = await Promise.all([window.vision.fs.modifiedTimes(found.value), location ? emptySubfolders(location) : Promise.resolve([])]);
        if (request !== latest.current) return;
        setError(null);
        setBoards(found.value);
        setTimes(modified.ok ? modified.value : {});
        setEmptyFolders(empty ?? []);
        setLocationMissing(empty === null);
      });
    },
    [root, location],
  );

  const version = useLibraryVersion((state) => state.version);
  useEffect(() => {
    if (active) void reload();
  }, [active, reload, version]);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only boards and folders coming or going change the lists; an autosave doesn't. Reload once changes settle.
    const unsubscribe = window.vision.fs.onChange(({ path, kind }) => {
      if (kind === 'change' || (!isBoardFile(path) && kind !== 'addDir' && kind !== 'unlinkDir')) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 400);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [active, reload]);

  return { boards, times, emptyFolders, error, locationMissing, reload };
}
