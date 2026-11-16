import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AppState, emptyAppState, normalizeAppState, pruneLayouts } from './appState';
import { logError } from './log';

const SAVE_DELAY_MS = 400;

let state: AppState = emptyAppState();
let saveTimer: NodeJS.Timeout | null = null;

function stateFilePath(): string {
  return join(app.getPath('userData'), 'state.json');
}

export function loadAppState(): void {
  try {
    state = normalizeAppState(JSON.parse(readFileSync(stateFilePath(), 'utf8')));
  } catch {
    state = emptyAppState();
  }
}

export function getAppState(): AppState {
  return state;
}

async function writeNow(): Promise<void> {
  const target = stateFilePath();
  const temp = `${target}.tmp`;
  const snapshot: AppState = { ...state, layouts: pruneLayouts(state) };
  try {
    await writeFile(temp, JSON.stringify(snapshot, null, 2), 'utf8');
    await rename(temp, target);
  } catch (error) {
    logError('Could not save app state', error);
  }
}

/** Changes the state and saves it shortly after (several quick changes become one write). */
export function updateAppState(change: (current: AppState) => AppState): void {
  state = change(state);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeNow();
  }, SAVE_DELAY_MS);
}

/** Writes any pending change right away. Called when the app quits. */
export async function flushAppState(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  await writeNow();
}
