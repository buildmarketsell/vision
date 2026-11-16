import type { Feature } from '../../renderer/core/feature';
import { ExplorerView, startCreate } from './renderer/ExplorerView';

export const explorerFeature: Feature = {
  id: 'explorer',
  name: 'Explorer',
  sidebarViews: [{ id: 'explorer', title: 'Files', component: ExplorerView }],
  commands: [
    { id: 'explorer.newFile', title: 'New File', run: () => startCreate('newFile') },
    { id: 'explorer.newFolder', title: 'New Folder', run: () => startCreate('newDir') },
  ],
};
