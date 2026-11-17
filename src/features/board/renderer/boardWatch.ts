import { useWorkspace } from '../../../renderer/core/workspaceStore';

const listeners = new Map<string, Set<() => void>>();

window.vision.fs.onChange(({ path, kind }) => {
  if (kind !== 'change' && kind !== 'add') return;
  for (const listener of listeners.get(path) ?? []) listener();
});

/** Calls `onChange` when the board file changes on disk; returns a function that stops watching. */
export function watchBoard(path: string, onChange: () => void): () => void {
  const forPath = listeners.get(path) ?? new Set();
  forPath.add(onChange);
  listeners.set(path, forPath);
  useWorkspace.getState().setWatched('board', [...listeners.keys()]);
  return () => {
    forPath.delete(onChange);
    if (forPath.size === 0) listeners.delete(path);
    useWorkspace.getState().setWatched('board', [...listeners.keys()]);
  };
}
