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
    saveLayout: (layout) => ipcRenderer.send(IPC.saveLayout, layout),
    setDirtyFiles: (paths) => ipcRenderer.send(IPC.setDirtyFiles, paths),
    setScheme: (scheme) => ipcRenderer.send(IPC.setScheme, scheme),
    onMenuCommand: (callback) => subscribe<MenuCommandId>(IPC.menuCommand, callback),
    pathForFile: (file) => webUtils.getPathForFile(file),
  },
  fs: {
    listDir: (path) => ipcRenderer.invoke(IPC.listDir, path),
    findFiles: (root, extension) => ipcRenderer.invoke(IPC.findFiles, root, extension),
    locate: (mention) => ipcRenderer.invoke(IPC.locate, mention),
    readFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
    writeFile: (path, content) => ipcRenderer.invoke(IPC.writeFile, path, content),
    saveImage: (notePath, bytes, ext) => ipcRenderer.invoke(IPC.saveImage, notePath, bytes, ext),
    saveVideo: (boardPath, source, ext) => ipcRenderer.invoke(IPC.saveVideo, boardPath, source, ext),
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
    start: (cols, rows, resumeSessionId) => ipcRenderer.invoke(IPC.ptyStart, cols, rows, resumeSessionId),
    write: (id, data) => ipcRenderer.send(IPC.ptyWrite, id, data),
    resize: (id, cols, rows) => ipcRenderer.send(IPC.ptyResize, id, cols, rows),
    kill: (id) => ipcRenderer.send(IPC.ptyKill, id),
    onData: (callback) => subscribe(IPC.ptyData, callback),
    onExit: (callback) => subscribe(IPC.ptyExit, callback),
  },
  inbox: {
    list: () => ipcRenderer.invoke(IPC.inboxList),
    add: (text) => ipcRenderer.invoke(IPC.inboxAdd, text),
    setDone: (id, done) => ipcRenderer.invoke(IPC.inboxSetDone, id, done),
    remove: (id) => ipcRenderer.invoke(IPC.inboxRemove, id),
    onChange: (callback) => subscribe(IPC.inboxChanged, callback),
  },
  todos: {
    list: () => ipcRenderer.invoke(IPC.todosList),
    add: (text, status) => ipcRenderer.invoke(IPC.todosAdd, text, status),
    update: (id, change) => ipcRenderer.invoke(IPC.todosUpdate, id, change),
    remove: (id) => ipcRenderer.invoke(IPC.todosRemove, id),
    onChange: (callback) => subscribe(IPC.todosChanged, callback),
  },
  databases: {
    list: () => ipcRenderer.invoke(IPC.databasesList),
    save: (database) => ipcRenderer.invoke(IPC.databasesSave, database),
    remove: (id) => ipcRenderer.invoke(IPC.databasesRemove, id),
    onChange: (callback) => subscribe(IPC.databasesChanged, callback),
  },
  pages: {
    list: () => ipcRenderer.invoke(IPC.pagesList),
    save: (page) => ipcRenderer.invoke(IPC.pagesSave, page),
    remove: (id) => ipcRenderer.invoke(IPC.pagesRemove, id),
    onChange: (callback) => subscribe(IPC.pagesChanged, callback),
  },
  calendar: {
    state: (force) => ipcRenderer.invoke(IPC.calendarState, force === true),
    range: (from, to, force) => ipcRenderer.invoke(IPC.calendarRange, from, to, force === true),
    setClient: (id, secret) => ipcRenderer.invoke(IPC.calendarSetClient, id, secret),
    signIn: () => ipcRenderer.invoke(IPC.calendarSignIn),
    cancelSignIn: () => ipcRenderer.send(IPC.calendarCancelSignIn),
    signOut: (email) => ipcRenderer.invoke(IPC.calendarSignOut, email),
    setVisible: (calendarKey, visible) => ipcRenderer.invoke(IPC.calendarSetVisible, calendarKey, visible),
    createEvent: (input) => ipcRenderer.invoke(IPC.calendarCreateEvent, input),
  },
  chat: {
    start: (options) => ipcRenderer.invoke(IPC.chatStart, options),
    send: (id, message) => ipcRenderer.send(IPC.chatSend, id, message),
    stop: (id) => ipcRenderer.send(IPC.chatStop, id),
    onEvent: (callback) => subscribe(IPC.chatEvent, callback),
    onExit: (callback) => subscribe(IPC.chatExit, callback),
    list: () => ipcRenderer.invoke(IPC.chatList),
    history: (sessionId) => ipcRenderer.invoke(IPC.chatHistory, sessionId),
  },
};

contextBridge.exposeInMainWorld('vision', api);
