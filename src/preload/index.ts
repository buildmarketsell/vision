import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type MenuCommandId, type Unsubscribe, type VisionApi } from '../shared/ipc';

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: VisionApi = {
  app: {
    getBootState: () => ipcRenderer.invoke(IPC.bootState),
    openFolderDialog: () => ipcRenderer.invoke(IPC.openFolderDialog),
    openFolder: (path) => ipcRenderer.invoke(IPC.openFolder, path),
    removeRecent: (path) => ipcRenderer.invoke(IPC.removeRecent, path),
    getWallpaper: () => ipcRenderer.invoke(IPC.getWallpaper),
    chooseWallpaper: () => ipcRenderer.invoke(IPC.chooseWallpaper),
    saveLayout: (layout) => ipcRenderer.send(IPC.saveLayout, layout),
    setDirtyFiles: (paths) => ipcRenderer.send(IPC.setDirtyFiles, paths),
    onMenuCommand: (callback) => subscribe<MenuCommandId>(IPC.menuCommand, callback),
    pathForFile: (file) => webUtils.getPathForFile(file),
  },
  fs: {
    listDir: (path) => ipcRenderer.invoke(IPC.listDir, path),
    readFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
    writeFile: (path, content) => ipcRenderer.invoke(IPC.writeFile, path, content),
    createFile: (parentDir, name) => ipcRenderer.invoke(IPC.createFile, parentDir, name),
    createDir: (parentDir, name) => ipcRenderer.invoke(IPC.createDir, parentDir, name),
    rename: (path, newName) => ipcRenderer.invoke(IPC.rename, path, newName),
    trash: (path) => ipcRenderer.invoke(IPC.trash, path),
    confirmTrash: (name) => ipcRenderer.invoke(IPC.confirmTrash, name),
    confirmDiscard: (name) => ipcRenderer.invoke(IPC.confirmDiscard, name),
    watch: (paths) => ipcRenderer.send(IPC.watch, paths),
    onChange: (callback) => subscribe(IPC.fsChange, callback),
  },
  pty: {
    start: (cols, rows) => ipcRenderer.invoke(IPC.ptyStart, cols, rows),
    write: (id, data) => ipcRenderer.send(IPC.ptyWrite, id, data),
    resize: (id, cols, rows) => ipcRenderer.send(IPC.ptyResize, id, cols, rows),
    kill: (id) => ipcRenderer.send(IPC.ptyKill, id),
    onData: (callback) => subscribe(IPC.ptyData, callback),
    onExit: (callback) => subscribe(IPC.ptyExit, callback),
  },
};

contextBridge.exposeInMainWorld('vision', api);
