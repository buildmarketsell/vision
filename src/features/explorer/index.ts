import { createElement } from 'react';
import { Files } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { WorkspacePanel, WorkspaceTabStrip } from '../../renderer/components/WorkspacePanel';
import { ExplorerView, startCreate } from './renderer/ExplorerView';

export const explorerFeature: Feature = {
  id: 'explorer',
  name: 'Explorer',
  sidebarViews: [{ id: 'explorer', title: 'Workspace', icon: createElement(Files, { size: 16, strokeWidth: 1.5 }), component: WorkspacePanel, header: WorkspaceTabStrip }],
  workspaceTabs: [{ id: 'files', title: 'Files', icon: createElement(Files, { size: 16, strokeWidth: 1.5 }), component: ExplorerView }],
  commands: [
    { id: 'explorer.newFile', title: 'New File', run: () => startCreate('newFile') },
    { id: 'explorer.newFolder', title: 'New Folder', run: () => startCreate('newDir') },
  ],
};
