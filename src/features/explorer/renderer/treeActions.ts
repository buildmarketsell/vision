import { openFile } from '../../../renderer/core/dockActions';
import { unsavedTabInside, withTabsClosed } from '../../../renderer/core/fileTabs';
import { baseName, parentPath } from '../../../renderer/core/workspaceStore';
import { useTree } from './treeStore';

const tree = () => useTree.getState();

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
  const unsaved = unsavedTabInside(path);
  if (unsaved) {
    tree().setNotice(`Save or close "${unsaved}" before renaming.`);
    return;
  }
  const result = await withTabsClosed(path, () => window.vision.fs.rename(path, newName));
  if (!result.ok) {
    tree().setNotice(`Could not rename: ${result.error}`);
    return;
  }
  tree().forget(path);
  await tree().loadDir(parentPath(path));
  tree().select(result.value);
}

export async function trashEntry(path: string): Promise<void> {
  const confirmed = await window.vision.fs.confirmTrash(baseName(path));
  if (!confirmed) return;
  const result = await withTabsClosed(path, () => window.vision.fs.trash(path));
  if (!result.ok) {
    tree().setNotice(`Could not move to Trash: ${result.error}`);
    return;
  }
  tree().forget(path);
  if (tree().selected === path) tree().select(null);
  await tree().loadDir(parentPath(path));
}
