import { closeFileTab, getDockApi, openFile } from './dockActions';
import { settleWrites } from './pendingWrites';
import { useTabStatus } from './tabStatus';
import { baseName } from './workspaceStore';
import type { Result } from '../../shared/ipc';

const isInside = (filePath: string, path: string) => filePath === path || filePath.startsWith(`${path}/`);

/** The name of an open tab with unsaved changes at or below `path`, or null. */
export function unsavedTabInside(path: string): string | null {
  for (const tabId of useTabStatus.getState().dirtyTabs) {
    const filePath = tabId.startsWith('file:') ? tabId.slice(5) : '';
    if (isInside(filePath, path)) return baseName(filePath);
  }
  return null;
}

/** Paths of open file tabs at or below `path`. */
function openTabsInside(path: string): string[] {
  const panels = getDockApi()?.panels ?? [];
  return panels.map((panel) => (panel.id.startsWith('file:') ? panel.id.slice(5) : '')).filter((filePath) => filePath !== '' && isInside(filePath, path));
}

/**
 * Renames, moves or trashes `path` with its open tabs out of the way. Tabs close first, so a board's last
 * autosave lands before the file moves (closing after would write it back at the old path), then reopen
 * at the new path, or where they were if it failed. Returns the operation's result.
 */
export async function withTabsClosed<T extends string | void>(path: string, change: () => Promise<Result<T>>): Promise<Result<T>> {
  const tabs = openTabsInside(path);
  for (const filePath of tabs) closeFileTab(filePath);
  // A closed tab unmounts on the next render; its last save starts then.
  if (tabs.length > 0) await new Promise(requestAnimationFrame);
  await settleWrites();
  const result = await change();
  for (const filePath of tabs) {
    if (!result.ok) openFile(filePath);
    else if (typeof result.value === 'string') openFile(result.value + filePath.slice(path.length));
  }
  return result;
}
