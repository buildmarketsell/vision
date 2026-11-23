import { createElement } from 'react';
import type { SearchProvider } from '../../../renderer/core/feature';
import { EntryIcon } from '../../../renderer/components/fileIcons';
import { showPanes } from '../../../renderer/core/activeView';
import { openFile } from '../../../renderer/core/dockActions';
import { revealPath } from './revealPath';

const parentOf = (relative: string) => relative.slice(0, Math.max(0, relative.lastIndexOf('/')));
const nameOf = (relative: string) => relative.slice(relative.lastIndexOf('/') + 1);

/** Files and folders in the open folder, by name (same search as ⌘P). A file opens in a tab, a folder unfolds in Files. */
export const fileSearchProvider: SearchProvider = {
  id: 'files',
  title: 'Files',
  search: async (query) => {
    const result = await window.vision.fs.search(query);
    if (!result.ok) return [];
    return result.value.map((hit) => ({
      id: `file:${hit.path}`,
      title: nameOf(hit.relative),
      detail: parentOf(hit.relative),
      kind: hit.isDirectory ? 'Folder' : 'File',
      icon: createElement(EntryIcon, { name: nameOf(hit.relative), isDirectory: hit.isDirectory }),
      run: () => {
        if (hit.isDirectory) return void revealPath(hit.path);
        showPanes();
        openFile(hit.path);
      },
    }));
  },
};
