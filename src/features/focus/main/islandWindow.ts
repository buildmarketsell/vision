import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { IPC, type FocusView, type IslandUpdate } from '../../../shared/ipc';
import { islandPlacement } from './islandPlacement';

/** Room for the island at its widest (hovered, with buttons); everything outside the island is see-through and lets clicks through. */
const WIDTH = 460;
const HEIGHT = 200;
const HEADLESS = process.env['VISION_HEADLESS'] === '1';

let island: BrowserWindow | null = null;
let ready = false;
let latest: FocusView | null = null;

/** The screen with the menu bar. */
const placement = () => islandPlacement(screen.getPrimaryDisplay(), WIDTH, HEIGHT);

function send(): void {
  if (!island || island.isDestroyed() || !ready || !latest) return;
  const { notch, menuBar } = placement();
  const update: IslandUpdate = { view: latest, notch, menuBar };
  island.webContents.send(IPC.islandUpdate, update);
}

function create(): BrowserWindow {
  const window = new BrowserWindow({
    ...placement().bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Never takes focus from the app Dan is working in.
    focusable: false,
    skipTaskbar: true,
    roundedCorners: false,
    // Lets it sit over the menu bar, where the notch is.
    enableLargerThanScreen: true,
    webPreferences: { preload: join(app.getAppPath(), 'out/preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.setAlwaysOnTop(true, 'screen-saver');
  // On every Space and over full-screen apps; skipTransformProcessType keeps VISION's Dock icon.
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  window.setIgnoreMouseEvents(true, { forward: true });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('did-finish-load', () => {
    ready = true;
    send();
  });
  window.on('closed', () => {
    island = null;
    ready = false;
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void window.loadURL(`${devUrl}/island.html`);
  else void window.loadFile(join(app.getAppPath(), 'out/renderer/island.html'));
  return window;
}

/** Shows the island while there is something to show and Dan has it on; hides it otherwise. Made the first time it's needed. */
export function updateIsland(view: FocusView): void {
  latest = view;
  const wanted = view.island && view.glance.kind !== 'idle';
  if (!island && !wanted) return;
  island ??= create();
  send();
  if (HEADLESS) return;
  if (wanted && !island.isVisible()) {
    island.setBounds(placement().bounds);
    island.showInactive();
  } else if (!wanted && island.isVisible()) island.hide();
}

export function registerIsland(): void {
  // Over the island it takes clicks; anywhere else in its window they go to the app underneath.
  ipcMain.on(IPC.islandHover, (event, over: unknown) => {
    if (!island || island.isDestroyed() || event.sender !== island.webContents || typeof over !== 'boolean') return;
    island.setIgnoreMouseEvents(!over, { forward: true });
  });
  screen.on('display-metrics-changed', () => {
    if (island?.isVisible()) island.setBounds(placement().bounds);
    send();
  });
}

