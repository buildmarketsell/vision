import { useActiveViewStore } from '../../../renderer/core/activeView';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { selectWorkspaceTab } from '../../../renderer/components/WorkspacePanel';
import { useTree } from './treeStore';

/** Picks the Workspace view and its Files tab, and opens the sidebar if it is hidden. */
export function showFilesPanel(): void {
  const { sidebarCollapsed, toggleSidebar } = useWorkspace.getState();
  useActiveViewStore.getState().select('explorer');
  selectWorkspaceTab('files');
  if (sidebarCollapsed) toggleSidebar();
}

/** Opens the files panel, unfolds every folder down to `path`, selects it and scrolls it into view. */
export async function revealPath(path: string): Promise<void> {
  const { folder } = useWorkspace.getState();
  if (!folder || !path.startsWith(`${folder}/`)) return;
  showFilesPanel();

  const parts = path.slice(folder.length + 1).split('/');
  let dir = folder;
  for (const part of parts) {
    dir = `${dir}/${part}`;
    if (!useTree.getState().expanded.has(dir)) {
      useTree.setState((state) => ({ expanded: new Set(state.expanded).add(dir) }));
      await useTree.getState().loadDir(dir);
    }
  }
  useTree.getState().select(path);
  requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`[role="treeitem"][data-path="${CSS.escape(path)}"]`);
    row?.scrollIntoView({ block: 'center' });
    row?.focus({ preventScroll: true });
  });
}
