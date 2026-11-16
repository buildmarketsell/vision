import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { IPC, type MenuCommandId } from '../shared/ipc';
import { getAppState } from './stateStore';
import { createWindow, openFolderInWindow } from './windows';
import { showOpenFolderDialog } from './appHandlers';

function sendToFocusedWindow(id: MenuCommandId): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(IPC.menuCommand, id);
}

/**
 * A menu item whose shortcut is handled by the page itself (so it also works inside the
 * editor and terminal); the menu only shows the shortcut and handles mouse clicks.
 */
function rendererItem(label: string, accelerator: string, id: MenuCommandId): MenuItemConstructorOptions {
  return { label, accelerator, registerAccelerator: false, click: () => sendToFocusedWindow(id) };
}

function recentFoldersMenu(): MenuItemConstructorOptions[] {
  const recent = getAppState().recentFolders;
  if (recent.length === 0) return [{ label: 'No Recent Folders', enabled: false }];
  return recent.map((folder) => ({
    label: folder,
    click: () => openFolderInWindow(folder, BrowserWindow.getFocusedWindow() ?? undefined),
  }));
}

function fileMenu(): MenuItemConstructorOptions {
  return {
    label: 'File',
    submenu: [
      { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow(null) },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => void showOpenFolderDialog() },
      { label: 'Open Recent', submenu: recentFoldersMenu() },
      { type: 'separator' },
      rendererItem('Save', 'CmdOrCtrl+S', 'editor.save'),
      { type: 'separator' },
      rendererItem('Close Tab', 'CmdOrCtrl+W', 'tab.close'),
      { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' },
    ],
  };
}

function viewMenu(): MenuItemConstructorOptions {
  const devItems: MenuItemConstructorOptions[] = app.isPackaged ? [] : [{ role: 'reload' }];
  return {
    label: 'View',
    submenu: [
      rendererItem('Show Hidden Files', 'CmdOrCtrl+Shift+.', 'view.toggleHidden'),
      { type: 'separator' },
      ...devItems,
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };
}

/** Builds the macOS menu bar. Called again when the recent folders change. */
export function buildAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    fileMenu(),
    { role: 'editMenu' },
    viewMenu(),
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
