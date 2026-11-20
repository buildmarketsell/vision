import { app, ipcMain, nativeImage, shell } from 'electron';
import { IPC } from '../../shared/ipc';
import { isInsideFolder } from '../paths';
import { windowContextFor } from '../windows';

/** A drag needs an image under the cursor; a tiny gray square stands in if macOS has no icon for the file. */
const FALLBACK_DRAG_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR42mNYsGDBf0oww6gBowaMGjBcDAAAxPzfH3R/ZXQAAAAASUVORK5CYII=';
const MAX_DRAGGED_FILES = 500;

function pathsInFolder(event: Electron.IpcMainEvent, value: unknown): string[] | null {
  const folder = windowContextFor(event.sender)?.folder;
  if (!folder || !Array.isArray(value) || value.length === 0 || value.length > MAX_DRAGGED_FILES) return null;
  return value.every((path) => typeof path === 'string' && isInsideFolder(folder, path)) ? (value as string[]) : null;
}

/** Dragging files out to other apps, and Reveal in Finder. Only paths inside the window's open folder. */
export function registerFinderHandlers(): void {
  ipcMain.on(IPC.startDrag, async (event, value: unknown) => {
    const paths = pathsInFolder(event, value);
    if (!paths) return;
    const icon = await app.getFileIcon(paths[0] as string, { size: 'normal' }).catch(() => nativeImage.createFromDataURL(FALLBACK_DRAG_ICON));
    if (!event.sender.isDestroyed()) event.sender.startDrag({ file: paths[0] as string, files: paths, icon });
  });
  ipcMain.on(IPC.revealInFinder, (event, value: unknown) => {
    const paths = pathsInFolder(event, [value]);
    if (paths) shell.showItemInFolder(paths[0] as string);
  });
}
