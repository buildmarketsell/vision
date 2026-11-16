import { create } from 'zustand';
import { theme } from '../theme';

interface WorkspaceState {
  folder: string;
  showHidden: boolean;
  sidebarWidth: number;
  /** Extra paths features want watched (e.g. open files), keyed by feature id. */
  watchedByFeature: Record<string, string[]>;
  setFolder: (folder: string) => void;
  toggleHidden: () => void;
  setSidebarWidth: (width: number) => void;
  setWatched: (featureId: string, paths: string[]) => void;
}

function clampSidebar(width: number): number {
  const { sidebarMinWidth, sidebarMaxWidth } = theme.layout;
  return Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, Math.round(width)));
}

/** The open folder and window-wide workspace settings. */
export const useWorkspace = create<WorkspaceState>((set) => ({
  folder: '',
  showHidden: true,
  sidebarWidth: theme.layout.sidebarDefaultWidth,
  watchedByFeature: {},
  setFolder: (folder) => set({ folder }),
  toggleHidden: () => set((state) => ({ showHidden: !state.showHidden })),
  setSidebarWidth: (width) => set({ sidebarWidth: clampSidebar(width) }),
  setWatched: (featureId, paths) =>
    set((state) => ({ watchedByFeature: { ...state.watchedByFeature, [featureId]: paths } })),
}));

/** Drag type for a file path from the tree (e.g. dropped in Claude's message box as an @mention). */
export const PATH_DRAG_TYPE = 'application/x-vision-path';

/** The file or folder name at the end of a path. */
export function baseName(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** The folder that contains a path. */
export function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

/** The path relative to the open folder, split into parts (for breadcrumbs). */
export function relativeParts(folder: string, path: string): string[] {
  if (!path.startsWith(`${folder}/`)) return [baseName(path)];
  return path.slice(folder.length + 1).split('/');
}
