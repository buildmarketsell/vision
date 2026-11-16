import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC, type Result } from '../../shared/ipc';
import { isInsideFolder } from '../paths';
import { onWindowClosed, windowContextFor, type WindowContext } from '../windows';
import { IMAGE_EXTENSIONS, MAX_IMAGE_BYTES } from '../../shared/markdownImages';
import { createEntry, listDirectory, moveToTrash, readTextFile, renameEntry, saveImageNextTo, writeTextFile } from './fileSystem';
import { FolderWatcher } from './watcher';

const watchers = new Map<WindowContext, FolderWatcher>();

/** Returns the window's folder when every path is a string inside it, otherwise null. */
function guardPaths(event: IpcMainInvokeEvent | Electron.IpcMainEvent, paths: unknown[]): WindowContext | null {
  const context = windowContextFor(event.sender);
  const folder = context?.folder;
  if (!context || !folder) return null;
  const allInside = paths.every((path) => typeof path === 'string' && isInsideFolder(folder, path));
  return allInside ? context : null;
}

const OUTSIDE: Extract<Result<never>, { ok: false }> = { ok: false, error: 'That path is outside the open folder.' };

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

async function confirm(event: IpcMainInvokeEvent, message: string, detail: string, action: string): Promise<boolean> {
  const window = windowContextFor(event.sender)?.window;
  if (!window) return false;
  const options = { type: 'warning' as const, message, detail, buttons: [action, 'Cancel'], defaultId: 0, cancelId: 1 };
  return (await dialog.showMessageBox(window, options)).response === 0;
}

function watcherFor(context: WindowContext): FolderWatcher {
  let watcher = watchers.get(context);
  if (!watcher) {
    watcher = new FolderWatcher((change) => {
      if (!context.webContents.isDestroyed()) context.webContents.send(IPC.fsChange, change);
    });
    watchers.set(context, watcher);
  }
  return watcher;
}

function registerReadHandlers(): void {
  ipcMain.handle(IPC.listDir, (event, path: unknown) =>
    guardPaths(event, [path]) ? listDirectory(path as string) : OUTSIDE,
  );
  ipcMain.handle(IPC.readFile, (event, path: unknown) =>
    guardPaths(event, [path]) ? readTextFile(path as string) : { kind: 'error', message: OUTSIDE.error },
  );
}

function registerWriteHandlers(): void {
  ipcMain.handle(IPC.writeFile, (event, path: unknown, content: unknown) =>
    guardPaths(event, [path]) && isText(content) ? writeTextFile(path as string, content) : OUTSIDE,
  );
  ipcMain.handle(IPC.saveImage, (event, notePath: unknown, bytes: unknown, ext: unknown) => {
    if (!guardPaths(event, [notePath])) return OUTSIDE;
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'The image is empty or larger than 25 MB.' };
    }
    if (!isText(ext) || !(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, error: 'That is not an image type VISION knows.' };
    return saveImageNextTo(notePath as string, bytes, ext);
  });
  ipcMain.handle(IPC.createFile, (event, parent: unknown, name: unknown) =>
    guardPaths(event, [parent]) && isText(name) ? createEntry(parent as string, name, 'file') : OUTSIDE,
  );
  ipcMain.handle(IPC.createDir, (event, parent: unknown, name: unknown) =>
    guardPaths(event, [parent]) && isText(name) ? createEntry(parent as string, name, 'dir') : OUTSIDE,
  );
  ipcMain.handle(IPC.rename, (event, path: unknown, newName: unknown) => {
    const context = guardPaths(event, [path]);
    if (!context || !isText(newName) || path === context.folder) return OUTSIDE;
    return renameEntry(path as string, newName);
  });
  ipcMain.handle(IPC.trash, (event, path: unknown) => {
    const context = guardPaths(event, [path]);
    if (!context || path === context.folder) return OUTSIDE;
    return moveToTrash(path as string);
  });
}

function registerDialogHandlers(): void {
  ipcMain.handle(IPC.confirmTrash, (event, name: unknown) =>
    confirm(event, `Move "${String(name)}" to the Trash?`, 'You can put it back from the Trash in Finder.', 'Move to Trash'),
  );
  ipcMain.handle(IPC.confirmDiscard, (event, name: unknown) =>
    confirm(event, `Close "${String(name)}" without saving?`, 'Your unsaved changes will be lost.', 'Close Without Saving'),
  );
}

/** File system access for the renderer. Every path must be inside the window's open folder. */
export function registerFsHandlers(): void {
  registerReadHandlers();
  registerWriteHandlers();
  registerDialogHandlers();
  ipcMain.on(IPC.watch, (event, paths: unknown) => {
    if (!Array.isArray(paths)) return;
    const context = windowContextFor(event.sender);
    const folder = context?.folder;
    if (!context || !folder) return;
    const safe = paths.filter((path): path is string => typeof path === 'string' && isInsideFolder(folder, path));
    watcherFor(context).sync(safe);
  });
  onWindowClosed((context) => {
    void watchers.get(context)?.close();
    watchers.delete(context);
  });
}
