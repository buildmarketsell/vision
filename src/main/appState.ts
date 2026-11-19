import { MAX_RECENT_FOLDERS } from '../shared/app';
import type { FolderLayout } from '../shared/ipc';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SessionWindow {
  folder: string | null;
  bounds: WindowBounds | null;
}

/** Everything VISION remembers between launches. Saved as JSON in userData. */
export interface AppState {
  recentFolders: string[];
  windows: SessionWindow[];
  layouts: Record<string, FolderLayout>;
  /** Interface zoom (⌘+ / ⌘−), shared by all windows like VS Code. 0 is 100%. */
  zoomLevel: number;
}

export function emptyAppState(): AppState {
  return { recentFolders: [], windows: [], layouts: {}, zoomLevel: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if ([x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return { x: x as number, y: y as number, width: width as number, height: height as number };
  }
  return null;
}

function toWindows(value: unknown): SessionWindow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    folder: typeof item['folder'] === 'string' ? item['folder'] : null,
    bounds: toBounds(item['bounds']),
  }));
}

function toLayout(value: unknown): FolderLayout | null {
  if (!isRecord(value)) return null;
  const { sidebarWidth, sidebarCollapsed, showHidden } = value;
  return {
    dock: value['dock'] ?? null,
    sidebarWidth: typeof sidebarWidth === 'number' ? sidebarWidth : 260,
    sidebarCollapsed: sidebarCollapsed === true,
    showHidden: typeof showHidden === 'boolean' ? showHidden : true,
  };
}

export const MIN_ZOOM = -4;
export const MAX_ZOOM = 6;

/** A valid zoom level; anything else becomes 0 (100%). */
export function clampZoom(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 2) / 2));
}

/** Turns whatever was on disk into a valid AppState; anything broken falls back to defaults. */
export function normalizeAppState(raw: unknown): AppState {
  if (!isRecord(raw)) return emptyAppState();
  const layouts: Record<string, FolderLayout> = {};
  if (isRecord(raw['layouts'])) {
    for (const [folder, layout] of Object.entries(raw['layouts'])) {
      const parsed = toLayout(layout);
      if (parsed) layouts[folder] = parsed;
    }
  }
  return {
    recentFolders: toStringList(raw['recentFolders']).slice(0, MAX_RECENT_FOLDERS),
    windows: toWindows(raw['windows']),
    layouts,
    zoomLevel: clampZoom(raw['zoomLevel']),
  };
}

/** Moves `folder` to the top of the recent list, without duplicates, capped in length. */
export function withRecentFolder(recent: string[], folder: string): string[] {
  return [folder, ...recent.filter((item) => item !== folder)].slice(0, MAX_RECENT_FOLDERS);
}

/** Keeps saved layouts only for folders still in the recent list, so the file stays small. */
export function pruneLayouts(state: AppState): Record<string, FolderLayout> {
  const kept: Record<string, FolderLayout> = {};
  for (const folder of state.recentFolders) {
    const layout = state.layouts[folder];
    if (layout) kept[folder] = layout;
  }
  return kept;
}
