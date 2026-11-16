import { BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { IPC, type BootState, type FolderLayout, type Result } from '../shared/ipc';
import { normalizeAppState } from './appState';
import { getAppState, updateAppState } from './stateStore';
import { openFolderInWindow, windowContextFor } from './windows';
import { buildAppMenu } from './menu';

const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function bootStateFor(folder: string | null): BootState {
  const state = getAppState();
  const recentFolders = state.recentFolders.filter((item) => existsSync(item));
  if (recentFolders.length !== state.recentFolders.length) {
    updateAppState((current) => ({ ...current, recentFolders }));
    buildAppMenu();
  }
  return {
    folder,
    folderExists: folder !== null && isDirectory(folder),
    recentFolders,
    layout: folder ? (state.layouts[folder] ?? null) : null,
  };
}

export async function showOpenFolderDialog(): Promise<void> {
  const window = BrowserWindow.getFocusedWindow() ?? undefined;
  const options = { properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const folder = result.filePaths[0];
  if (result.canceled || !folder) return;
  openFolderInWindow(folder, window);
  buildAppMenu();
}

async function imageAsDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const mimeType = IMAGE_TYPES[extname(path).toLowerCase()];
  if (!mimeType) return null;
  try {
    if ((await stat(path)).size > MAX_WALLPAPER_BYTES) return null;
    return `data:${mimeType};base64,${(await readFile(path)).toString('base64')}`;
  } catch {
    return null;
  }
}

async function chooseWallpaper(window: BrowserWindow | null): Promise<string | null> {
  const options = { properties: ['openFile' as const], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }] };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const path = result.filePaths[0];
  if (result.canceled || !path) return null;
  const dataUrl = await imageAsDataUrl(path);
  if (dataUrl) updateAppState((state) => ({ ...state, wallpaperPath: path }));
  return dataUrl;
}

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.bootState, (event) => bootStateFor(windowContextFor(event.sender)?.folder ?? null));

  ipcMain.handle(IPC.openFolderDialog, () => showOpenFolderDialog());

  ipcMain.handle(IPC.openFolder, (event, path: unknown): Result<void> => {
    if (typeof path !== 'string' || !isDirectory(path)) return { ok: false, error: 'That is not a folder.' };
    openFolderInWindow(path, BrowserWindow.fromWebContents(event.sender) ?? undefined);
    buildAppMenu();
    return { ok: true, value: undefined };
  });

  ipcMain.handle(IPC.removeRecent, (_event, path: unknown) => {
    updateAppState((state) => ({ ...state, recentFolders: state.recentFolders.filter((item) => item !== path) }));
    buildAppMenu();
    return getAppState().recentFolders;
  });

  ipcMain.handle(IPC.getWallpaper, () => imageAsDataUrl(getAppState().wallpaperPath));

  ipcMain.handle(IPC.chooseWallpaper, (event) => chooseWallpaper(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.on(IPC.saveLayout, (event, layout: unknown) => {
    const folder = windowContextFor(event.sender)?.folder;
    if (!folder) return;
    const parsed: FolderLayout | undefined = normalizeAppState({ layouts: { [folder]: layout } }).layouts[folder];
    if (parsed) updateAppState((state) => ({ ...state, layouts: { ...state.layouts, [folder]: parsed } }));
  });

  ipcMain.on(IPC.setDirtyFiles, (event, paths: unknown) => {
    const context = windowContextFor(event.sender);
    if (context && Array.isArray(paths)) {
      context.dirtyFiles = paths.filter((item): item is string => typeof item === 'string');
    }
  });
}
