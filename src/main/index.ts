import { app, BrowserWindow } from 'electron';
import { APP_NAME } from '../shared/app';
import { registerAppHandlers } from './appHandlers';
import { buildAppMenu } from './menu';
import { mainFeatures } from './registry';
import { resolveShellPath } from './shellEnv';
import { flushAppState, loadAppState } from './stateStore';
import { createWindow, restoreSession, setQuitting } from './windows';
import { registerFsHandlers } from './workspace/fsHandlers';
import { registerImageProtocol, registerImageScheme } from './workspace/imageProtocol';
import { registerPreviewProtocol } from './workspace/previewProtocol';
import { killAllClaudeSessions } from '../features/claude-terminal/main/ptyHandlers';
import { stopAllChats } from '../features/claude-terminal/main/chatProcess';

app.setName(APP_NAME);

// Tests run with their own, throwaway settings folder.
const testUserData = process.env['VISION_USER_DATA'];
if (testUserData) app.setPath('userData', testUserData);
// Background mode for tests: no Dock icon and no visible windows.
if (process.env['VISION_HEADLESS'] === '1') app.dock?.hide();

registerImageScheme();

let stateFlushed = false;

app.whenReady().then(() => {
  loadAppState();
  void resolveShellPath();
  registerAppHandlers();
  registerFsHandlers();
  registerImageProtocol();
  registerPreviewProtocol();
  for (const registerFeature of mainFeatures) registerFeature();
  buildAppMenu();
  restoreSession();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
  });
});

app.on('before-quit', (event) => {
  setQuitting(true);
  if (stateFlushed) return;
  // Save the open windows before they close, then quit for real.
  event.preventDefault();
  void flushAppState().then(() => {
    stateFlushed = true;
    app.quit();
  });
});

app.on('will-quit', () => {
  killAllClaudeSessions();
  stopAllChats();
});

// On macOS the app stays open with no windows, like other Mac apps.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
