import { app, BrowserWindow, dialog, shell, type WebContents } from 'electron';
import { join } from 'node:path';
import type { WindowBounds } from './appState';
import { getAppState, updateAppState } from './stateStore';
import { clampZoom, withRecentFolder } from './appState';

export interface WindowContext {
  window: BrowserWindow;
  /** Kept here because window.webContents throws once the window is destroyed. */
  webContents: WebContents;
  folder: string | null;
  dirtyFiles: string[];
  closeConfirmed: boolean;
}

type WindowClosedListener = (context: WindowContext) => void;

const contexts = new Map<number, WindowContext>();
const closedListeners: WindowClosedListener[] = [];
let isQuitting = false;

const DEFAULT_SIZE = { width: 1440, height: 900 };
/** Background mode for tests: windows render but are never shown. */
const HEADLESS = process.env['VISION_HEADLESS'] === '1';
const BACKGROUND_COLOR = '#FFFFFF';

export function setQuitting(value: boolean): void {
  isQuitting = value;
}

export function windowContextFor(sender: WebContents): WindowContext | undefined {
  return contexts.get(sender.id);
}

export function allWindowContexts(): WindowContext[] {
  return [...contexts.values()];
}

/** Features use this to clean up (kill processes, close watchers) when a window closes. */
export function onWindowClosed(listener: WindowClosedListener): void {
  closedListeners.push(listener);
}

function saveSession(): void {
  const windows = allWindowContexts().map(({ window, folder }) => ({
    folder,
    bounds: window.isDestroyed() ? null : window.getNormalBounds(),
  }));
  updateAppState((state) => ({ ...state, windows }));
}

function loadRenderer(window: BrowserWindow): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(join(app.getAppPath(), 'out/renderer/index.html'));
}

function lockDownNavigation(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function confirmCloseWithUnsavedFiles(context: WindowContext): Promise<void> {
  const count = context.dirtyFiles.length;
  const { response } = await dialog.showMessageBox(context.window, {
    type: 'warning',
    message: count === 1 ? 'You have 1 unsaved file.' : `You have ${count} unsaved files.`,
    detail: 'Closing the window loses those changes.',
    buttons: ['Close Without Saving', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) {
    context.closeConfirmed = true;
    context.window.close();
  } else {
    isQuitting = false;
  }
}

function watchWindowEvents(context: WindowContext, webContentsId: number): void {
  const { window } = context;
  window.on('close', (event) => {
    if (context.dirtyFiles.length > 0 && !context.closeConfirmed) {
      event.preventDefault();
      void confirmCloseWithUnsavedFiles(context);
    }
  });
  window.on('closed', () => {
    contexts.delete(webContentsId);
    for (const listener of closedListeners) listener(context);
    if (!isQuitting) saveSession();
  });
  window.on('moved', saveSession);
  window.on('resized', saveSession);
}

/** Zooms every window (⌘+ / ⌘− / ⌘0) and remembers the level. `step` 0 resets to 100%. */
export function changeZoom(step: number): void {
  const zoomLevel = step === 0 ? 0 : clampZoom(getAppState().zoomLevel + step);
  updateAppState((state) => ({ ...state, zoomLevel }));
  for (const { webContents } of allWindowContexts()) {
    if (!webContents.isDestroyed()) webContents.setZoomLevel(zoomLevel);
  }
}

export function createWindow(folder: string | null, bounds: WindowBounds | null = null): BrowserWindow {
  const window = new BrowserWindow({
    ...(bounds ?? DEFAULT_SIZE),
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'VISION',
    titleBarStyle: 'hiddenInset',
    /** Centered in the 36px top row (the lights are 12px tall). */
    trafficLightPosition: { x: 16, y: 12 },
    backgroundColor: BACKGROUND_COLOR,
    webPreferences: {
      preload: join(app.getAppPath(), 'out/preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const webContentsId = window.webContents.id;
  const context: WindowContext = { window, webContents: window.webContents, folder, dirtyFiles: [], closeConfirmed: false };
  contexts.set(webContentsId, context);
  lockDownNavigation(window);
  watchWindowEvents(context, webContentsId);
  window.webContents.on('did-finish-load', () => window.webContents.setZoomLevel(getAppState().zoomLevel));
  if (!HEADLESS) window.once('ready-to-show', () => window.show());
  loadRenderer(window);
  saveSession();
  return window;
}

/**
 * Opens a folder: focuses the window that already has it, reuses `fromWindow` when it has
 * no folder yet (the Welcome screen), otherwise opens a new window.
 */
export function openFolderInWindow(folder: string, fromWindow?: BrowserWindow): void {
  updateAppState((state) => ({ ...state, recentFolders: withRecentFolder(state.recentFolders, folder) }));
  const existing = allWindowContexts().find((context) => context.folder === folder);
  if (existing) {
    existing.window.focus();
    return;
  }
  const reusable = fromWindow ? windowContextFor(fromWindow.webContents) : undefined;
  if (reusable && reusable.folder === null) {
    reusable.folder = folder;
    saveSession();
    reusable.window.webContents.reload();
    return;
  }
  createWindow(folder);
}

/** Reopens the windows from the last session, or one Welcome window. */
export function restoreSession(): void {
  const { windows } = getAppState();
  if (windows.length === 0) {
    createWindow(null);
    return;
  }
  for (const saved of windows) createWindow(saved.folder, saved.bounds);
}
