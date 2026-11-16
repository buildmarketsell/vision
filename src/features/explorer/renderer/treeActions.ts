import { closeFileTab, getDockApi, openFile } from '../../../renderer/core/dockActions';
import { useTabStatus } from '../../../renderer/core/tabStatus';
import { baseName, parentPath } from '../../../renderer/core/workspaceStore';
import { useTree } from './treeStore';

const tree = () => useTree.getState();

function hasUnsavedTabInside(path: string): string | null {
  for (const tabId of useTabStatus.getState().dirtyTabs) {
    const filePath = tabId.startsWith('file:') ? tabId.slice(5) : '';
    if (filePath === path || filePath.startsWith(`${path}/`)) return baseName(filePath);
  }
  return null;
}

/** Paths of open file tabs at or below `path`. */
function openTabsInside(path: string): string[] {
  const panels = getDockApi()?.panels ?? [];
  return panels
    .map((panel) => (panel.id.startsWith('file:') ? panel.id.slice(5) : ''))
    .filter((filePath) => filePath === path || filePath.startsWith(`${path}/`));
}

export async function createEntry(parent: string, name: string, kind: 'newFile' | 'newDir'): Promise<void> {
  const fs = window.vision.fs;
  const result = kind === 'newDir' ? await fs.createDir(parent, name) : await fs.createFile(parent, name);
  tree().setEdit(null);
  if (!result.ok) {
    tree().setNotice(`Could not create "${name}": ${result.error}`);
    return;
  }
  await tree().loadDir(parent);
  tree().select(result.value);
  if (kind === 'newFile') openFile(result.value);
}

export async function renameEntry(path: string, newName: string): Promise<void> {
  tree().setEdit(null);
  const unsaved = hasUnsavedTabInside(path);
  if (unsaved) {
    tree().setNotice(`Save or close "${unsaved}" before renaming.`);
    return;
  }
  const result = await window.vision.fs.rename(path, newName);
  if (!result.ok) {
    tree().setNotice(`Could not rename: ${result.error}`);
    return;
  }
  const reopen = openTabsInside(path);
  for (const filePath of reopen) closeFileTab(filePath);
  tree().forget(path);
  await tree().loadDir(parentPath(path));
  tree().select(result.value);
  for (const filePath of reopen) openFile(result.value + filePath.slice(path.length));
}

export async function trashEntry(path: string): Promise<void> {
  const confirmed = await window.vision.fs.confirmTrash(baseName(path));
  if (!confirmed) return;
  const result = await window.vision.fs.trash(path);
  if (!result.ok) {
    tree().setNotice(`Could not move to Trash: ${result.error}`);
    return;
  }
  for (const filePath of openTabsInside(path)) closeFileTab(filePath);
  tree().forget(path);
  if (tree().selected === path) tree().select(null);
  await tree().loadDir(parentPath(path));
}
