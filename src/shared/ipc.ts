/** Types shared by the main process, the preload bridge and the renderer. */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isHidden: boolean;
}

export type ReadFileResult =
  | { kind: 'text'; content: string }
  | { kind: 'binary' }
  | { kind: 'tooLarge'; sizeBytes: number }
  | { kind: 'error'; message: string };

/** What the renderer saves per folder: the dockview layout and sidebar state. */
export interface FolderLayout {
  dock: unknown;
  sidebarWidth: number;
  showHidden: boolean;
}

export interface BootState {
  folder: string | null;
  folderExists: boolean;
  recentFolders: string[];
  layout: FolderLayout | null;
}

export interface FsChangeEvent {
  path: string;
  kind: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';
}

export type PtyStartResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not-found' | 'no-folder' | 'spawn-failed'; message: string };

export interface PtyDataEvent {
  id: number;
  data: string;
}

export interface PtyExitEvent {
  id: number;
  exitCode: number;
}

/** Commands the main process sends to a window (from the app menu). */
export type MenuCommandId = 'editor.save' | 'tab.close' | 'view.toggleHidden' | 'view.changeWallpaper';

export type Unsubscribe = () => void;

export interface VisionApi {
  app: {
    getBootState(): Promise<BootState>;
    openFolderDialog(): Promise<void>;
    openFolder(path: string): Promise<Result<void>>;
    removeRecent(path: string): Promise<string[]>;
    getWallpaper(): Promise<string | null>;
    chooseWallpaper(): Promise<string | null>;
    saveLayout(layout: FolderLayout): void;
    setDirtyFiles(paths: string[]): void;
    onMenuCommand(callback: (id: MenuCommandId) => void): Unsubscribe;
    pathForFile(file: File): string;
  };
  fs: {
    listDir(path: string): Promise<Result<DirEntry[]>>;
    readFile(path: string): Promise<ReadFileResult>;
    writeFile(path: string, content: string): Promise<Result<void>>;
    createFile(parentDir: string, name: string): Promise<Result<string>>;
    createDir(parentDir: string, name: string): Promise<Result<string>>;
    rename(path: string, newName: string): Promise<Result<string>>;
    trash(path: string): Promise<Result<void>>;
    confirmTrash(name: string): Promise<boolean>;
    confirmDiscard(name: string): Promise<boolean>;
    watch(paths: string[]): void;
    onChange(callback: (event: FsChangeEvent) => void): Unsubscribe;
  };
  pty: {
    start(cols: number, rows: number): Promise<PtyStartResult>;
    write(id: number, data: string): void;
    resize(id: number, cols: number, rows: number): void;
    kill(id: number): void;
    onData(callback: (event: PtyDataEvent) => void): Unsubscribe;
    onExit(callback: (event: PtyExitEvent) => void): Unsubscribe;
  };
}

/** Channel names, one place, `<area>:<action>`. */
export const IPC = {
  bootState: 'app:bootState',
  openFolderDialog: 'app:openFolderDialog',
  openFolder: 'app:openFolder',
  removeRecent: 'app:removeRecent',
  getWallpaper: 'app:getWallpaper',
  chooseWallpaper: 'app:chooseWallpaper',
  saveLayout: 'app:saveLayout',
  setDirtyFiles: 'app:setDirtyFiles',
  menuCommand: 'app:menuCommand',
  listDir: 'fs:listDir',
  readFile: 'fs:readFile',
  writeFile: 'fs:writeFile',
  createFile: 'fs:createFile',
  createDir: 'fs:createDir',
  rename: 'fs:rename',
  trash: 'fs:trash',
  confirmTrash: 'fs:confirmTrash',
  confirmDiscard: 'fs:confirmDiscard',
  watch: 'fs:watch',
  fsChange: 'fs:change',
  ptyStart: 'claude-terminal:start',
  ptyWrite: 'claude-terminal:write',
  ptyResize: 'claude-terminal:resize',
  ptyKill: 'claude-terminal:kill',
  ptyData: 'claude-terminal:data',
  ptyExit: 'claude-terminal:exit',
} as const;
