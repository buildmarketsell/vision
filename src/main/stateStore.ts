import { app } from 'electron';
import { join } from 'node:path';
import { type AppState, normalizeAppState, pruneLayouts } from './appState';
import { createDocumentStore } from './documentStore';
import { logError } from './log';

const document = createDocumentStore<AppState>({
  path: () => join(app.getPath('userData'), 'state.json'),
  read: normalizeAppState,
  write: (state) => ({ ...state, layouts: pruneLayouts(state) }),
  saveDelayMs: 400,
});

/** Reads state.json; call once at startup, before any window opens. */
export function loadAppState(): void {
  document.get();
}

export function getAppState(): AppState {
  return document.get();
}

/** Changes the state and saves it shortly after (several quick changes become one write). */
export function updateAppState(change: (current: AppState) => AppState): void {
  document.set(change(document.get())).catch((error: unknown) => logError('Could not save app state', error));
}

/** Writes any pending change right away. Called when the app quits. */
export function flushAppState(): Promise<void> {
  return document.flush().catch((error: unknown) => logError('Could not save app state', error));
}
