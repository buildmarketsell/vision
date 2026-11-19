/** Types shared by the main process, the preload bridge and the renderer. */
import type { CalendarState, NewEventInput } from './calendar';
import type { InboxMessage } from './inbox';
import type { TodoChange, TodoItem, TodoStatus } from './todos';
import type { ChatEventMessage, ChatExitMessage, ChatOutgoing, ChatStartOptions, ChatStartResult, PastConversation } from './claudeChat';

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
  sidebarCollapsed: boolean;
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
export type MenuCommandId = 'editor.save' | 'tab.close' | 'view.toggleHidden';

export type Unsubscribe = () => void;

export interface VisionApi {
  app: {
    getBootState(): Promise<BootState>;
    openFolderDialog(): Promise<void>;
    openFolder(path: string): Promise<Result<void>>;
    removeRecent(path: string): Promise<string[]>;
    saveLayout(layout: FolderLayout): void;
    setDirtyFiles(paths: string[]): void;
    onMenuCommand(callback: (id: MenuCommandId) => void): Unsubscribe;
    pathForFile(file: File): string;
  };
  fs: {
    listDir(path: string): Promise<Result<DirEntry[]>>;
    readFile(path: string): Promise<ReadFileResult>;
    writeFile(path: string, content: string): Promise<Result<void>>;
    /** Saves image bytes in the `images/` folder next to a note; returns the new file's path. */
    saveImage(notePath: string, bytes: Uint8Array, ext: string): Promise<Result<string>>;
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
    /** With a session id, the terminal continues that conversation (`claude --resume`). */
    start(cols: number, rows: number, resumeSessionId?: string): Promise<PtyStartResult>;
    write(id: number, data: string): void;
    resize(id: number, cols: number, rows: number): void;
    kill(id: number): void;
    onData(callback: (event: PtyDataEvent) => void): Unsubscribe;
    onExit(callback: (event: PtyExitEvent) => void): Unsubscribe;
  };
  inbox: {
    list(): Promise<InboxMessage[]>;
    /** Each returns the whole inbox after the change. */
    add(text: string): Promise<InboxMessage[]>;
    setDone(id: string, done: boolean): Promise<InboxMessage[]>;
    remove(id: string): Promise<InboxMessage[]>;
    /** Fires in every window when any window changes the inbox. */
    onChange(callback: (messages: InboxMessage[]) => void): Unsubscribe;
  };
  todos: {
    list(): Promise<TodoItem[]>;
    /** Each returns the whole list after the change. */
    add(text: string, status?: TodoStatus): Promise<TodoItem[]>;
    update(id: string, change: TodoChange): Promise<TodoItem[]>;
    remove(id: string): Promise<TodoItem[]>;
    /** Fires in every window when any window changes the list. */
    onChange(callback: (todos: TodoItem[]) => void): Unsubscribe;
  };
  calendar: {
    /** Upcoming events from every signed-in account; `force` skips the few-minute cache (refresh button). */
    state(force?: boolean): Promise<CalendarState>;
    /** Saves the Google Cloud client (Client ID and secret) VISION signs in with. */
    setClient(id: string, secret: string): Promise<CalendarState>;
    /** Opens Google's sign-in in the browser; adds the account (or signs it in again). */
    signIn(): Promise<CalendarState>;
    /** Stops waiting for Google (the sign-in then answers with "Sign-in cancelled."). */
    cancelSignIn(): void;
    signOut(email: string): Promise<CalendarState>;
    setVisible(calendarKey: string, visible: boolean): Promise<CalendarState>;
    createEvent(input: NewEventInput): Promise<Result<CalendarState>>;
  };
  chat: {
    start(options: ChatStartOptions): Promise<ChatStartResult>;
    send(id: number, message: ChatOutgoing): void;
    stop(id: number): void;
    onEvent(callback: (message: ChatEventMessage) => void): Unsubscribe;
    onExit(callback: (message: ChatExitMessage) => void): Unsubscribe;
    /** Saved conversations for the open folder, newest first. */
    list(): Promise<PastConversation[]>;
    /** A saved conversation's messages, as stream events. */
    history(sessionId: string): Promise<unknown[]>;
  };
}

/** Channel names, one place, `<area>:<action>`. */
export const IPC = {
  bootState: 'app:bootState',
  openFolderDialog: 'app:openFolderDialog',
  openFolder: 'app:openFolder',
  removeRecent: 'app:removeRecent',
  saveLayout: 'app:saveLayout',
  setDirtyFiles: 'app:setDirtyFiles',
  menuCommand: 'app:menuCommand',
  listDir: 'fs:listDir',
  readFile: 'fs:readFile',
  writeFile: 'fs:writeFile',
  saveImage: 'fs:saveImage',
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
  chatStart: 'claude-chat:start',
  chatSend: 'claude-chat:send',
  chatStop: 'claude-chat:stop',
  chatEvent: 'claude-chat:event',
  chatExit: 'claude-chat:exit',
  chatList: 'claude-chat:list',
  chatHistory: 'claude-chat:history',
  inboxList: 'inbox:list',
  inboxAdd: 'inbox:add',
  inboxSetDone: 'inbox:setDone',
  inboxRemove: 'inbox:remove',
  inboxChanged: 'inbox:changed',
  todosList: 'todos:list',
  todosAdd: 'todos:add',
  todosUpdate: 'todos:update',
  todosRemove: 'todos:remove',
  todosChanged: 'todos:changed',
  calendarState: 'calendar:state',
  calendarSetClient: 'calendar:setClient',
  calendarSignIn: 'calendar:signIn',
  calendarCancelSignIn: 'calendar:cancelSignIn',
  calendarSignOut: 'calendar:signOut',
  calendarSetVisible: 'calendar:setVisible',
  calendarCreateEvent: 'calendar:createEvent',
} as const;
