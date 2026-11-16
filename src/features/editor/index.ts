import { createElement } from 'react';
import type { Feature } from '../../renderer/core/feature';
import { activeParams } from '../../renderer/core/dockActions';
import { baseName } from '../../renderer/core/workspaceStore';
import { EntryIcon } from '../../renderer/components/fileIcons';
import { EditorPanel } from './renderer/EditorPanel';
import { isDirty, useEditor } from './renderer/editorStore';

export const EDITOR_TAB = 'editor';

export const editorFeature: Feature = {
  id: 'editor',
  name: 'Editor',
  tabTypes: [
    {
      id: EDITOR_TAB,
      component: EditorPanel,
      closable: true,
      icon: (params) => createElement(EntryIcon, { name: params.path ?? '', size: 14 }),
      canClose: async ({ path = '' }) =>
        !isDirty(useEditor.getState().buffers[path]) || window.vision.fs.confirmDiscard(baseName(path)),
      onClosed: ({ path = '' }) => useEditor.getState().drop(path),
    },
  ],
  fileHandlers: [{ tabType: EDITOR_TAB, matches: () => true }],
  commands: [
    {
      id: 'editor.save',
      title: 'Save',
      shortcut: 'Mod+S',
      run: () => {
        const path = activeParams(EDITOR_TAB)?.path;
        if (path) void useEditor.getState().save(path);
      },
    },
  ],
};
