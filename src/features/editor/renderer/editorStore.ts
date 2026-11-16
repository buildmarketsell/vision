import { create } from 'zustand';
import type { FsChangeEvent } from '../../../shared/ipc';
import { fileTabId } from '../../../renderer/core/dockActions';
import { useTabStatus } from '../../../renderer/core/tabStatus';
import { useWorkspace } from '../../../renderer/core/workspaceStore';

export type Buffer =
  | { status: 'loading' }
  | { status: 'binary' }
  | { status: 'tooLarge'; sizeBytes: number }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      saved: string;
      current: string;
      /** Set when the file changed or vanished on disk while it had unsaved edits. */
      disk: 'changed' | 'deleted' | null;
      saving: boolean;
      saveError: string | null;
    };

type ReadyBuffer = Extract<Buffer, { status: 'ready' }>;

interface EditorState {
  buffers: Record<string, Buffer>;
  load: (path: string) => Promise<void>;
  edit: (path: string, text: string) => void;
  save: (path: string) => Promise<void>;
  keepMine: (path: string) => void;
  drop: (path: string) => void;
  handleDiskChange: (change: FsChangeEvent) => Promise<void>;
}

function readyBuffer(buffers: Record<string, Buffer>, path: string): ReadyBuffer | null {
  const buffer = buffers[path];
  return buffer && buffer.status === 'ready' ? buffer : null;
}

export function isDirty(buffer: Buffer | undefined): boolean {
  return buffer?.status === 'ready' && buffer.current !== buffer.saved;
}

export const useEditor = create<EditorState>((set, get) => {
  const patch = (path: string, change: Partial<ReadyBuffer>) => {
    const buffer = readyBuffer(get().buffers, path);
    if (buffer) set((state) => ({ buffers: { ...state.buffers, [path]: { ...buffer, ...change } } }));
  };

  return {
    buffers: {},

    load: async (path) => {
      set((state) => ({ buffers: { ...state.buffers, [path]: { status: 'loading' } } }));
      const result = await window.vision.fs.readFile(path);
      let buffer: Buffer;
      if (result.kind === 'text') {
        buffer = { status: 'ready', saved: result.content, current: result.content, disk: null, saving: false, saveError: null };
      } else if (result.kind === 'tooLarge') buffer = { status: 'tooLarge', sizeBytes: result.sizeBytes };
      else if (result.kind === 'binary') buffer = { status: 'binary' };
      else buffer = { status: 'error', message: result.message };
      set((state) => ({ buffers: { ...state.buffers, [path]: buffer } }));
    },

    edit: (path, text) => patch(path, { current: text }),

    save: async (path) => {
      const buffer = readyBuffer(get().buffers, path);
      if (!buffer || buffer.saving) return;
      const content = buffer.current;
      patch(path, { saving: true, saveError: null });
      const result = await window.vision.fs.writeFile(path, content);
      if (result.ok) patch(path, { saving: false, saved: content, disk: null });
      else patch(path, { saving: false, saveError: result.error });
    },

    /** Keep the unsaved edits and stop warning about the change on disk. */
    keepMine: (path) => patch(path, { disk: null }),

    drop: (path) =>
      set((state) => {
        const buffers = { ...state.buffers };
        delete buffers[path];
        return { buffers };
      }),

    handleDiskChange: async ({ path, kind }) => {
      const buffer = readyBuffer(get().buffers, path);
      if (!buffer) return;
      if (kind === 'unlink') {
        patch(path, { disk: 'deleted' });
        return;
      }
      const result = await window.vision.fs.readFile(path);
      if (result.kind !== 'text' || result.content === buffer.saved) {
        if (buffer.disk === 'deleted') patch(path, { disk: null });
        return;
      }
      // No unsaved edits: take the new version quietly. Otherwise ask.
      if (!isDirty(buffer)) patch(path, { saved: result.content, current: result.content, disk: null });
      else patch(path, { disk: 'changed' });
    },
  };
});

/** Re-reads the file from disk, dropping unsaved edits. */
export function reloadFromDisk(path: string): void {
  void useEditor.getState().load(path);
}

/** Mirrors editor state to the tab dots, the window's close check and the file watcher. */
useEditor.subscribe((state, previous) => {
  if (state.buffers === previous.buffers) return;
  const paths = Object.keys(state.buffers);
  const dirtyPaths = paths.filter((path) => isDirty(state.buffers[path]));
  const { setDirty } = useTabStatus.getState();
  for (const path of new Set([...paths, ...Object.keys(previous.buffers)])) {
    setDirty(fileTabId(path), dirtyPaths.includes(path));
  }
  window.vision.app.setDirtyFiles(dirtyPaths);
  useWorkspace.getState().setWatched('editor', paths);
});

window.vision.fs.onChange((change) => void useEditor.getState().handleDiskChange(change));
