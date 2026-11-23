import { useEffect, useState, type DragEvent } from 'react';
import type { BootState, MenuCommandId } from '../shared/ipc';
import { installKeybindings, registerCommands, runCommand } from './core/commands';
import { closeActivePanel } from './core/dockActions';
import { useWorkspace } from './core/workspaceStore';
import { FolderMissing, Welcome } from './components/Welcome';
import { draggedTreePaths } from './core/treeDrag';
import { Workspace } from './components/Workspace';
import { PALETTE_COMMAND, usePalette } from './core/palette/paletteResults';

function useAppCommands(): void {
  useEffect(() => {
    registerCommands([
      { id: PALETTE_COMMAND, title: 'Search VISION', shortcut: 'Mod+K', run: () => usePalette.getState().toggle() },
      { id: 'tab.close', title: 'Close Tab', shortcut: 'Mod+W', run: closeActivePanel },
      { id: 'view.toggleMenu', title: 'Toggle Menu', shortcut: 'Mod+\\', run: () => useWorkspace.getState().toggleMenu() },
      { id: 'view.toggleSidebar', title: 'Toggle Sidebar', shortcut: 'Mod+Shift+|', run: () => useWorkspace.getState().toggleSidebar() },
      { id: 'view.toggleHidden', title: 'Show Hidden Files', shortcut: 'Mod+Shift+.', run: () => useWorkspace.getState().toggleHidden() },
    ]);
    const uninstall = installKeybindings();
    const offMenu = window.vision.app.onMenuCommand((id: MenuCommandId) => runCommand(id));
    return () => {
      uninstall();
      offMenu();
    };
  }, []);
}

/** Dropping a folder from Finder opens it (here if this window has none, otherwise in a new one). */
function useFolderDrop() {
  const [dropError, setDropError] = useState<string | null>(null);
  const onDragOver = (event: DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  };
  const onDrop = async (event: DragEvent) => {
    const file = event.dataTransfer.files[0];
    if (!file || draggedTreePaths(event.dataTransfer.files)) return;
    event.preventDefault();
    const result = await window.vision.app.openFolder(window.vision.app.pathForFile(file));
    if (!result.ok) {
      setDropError('Drop a folder, not a file, to open it.');
      setTimeout(() => setDropError(null), 3000);
    }
  };
  return { dropError, onDragOver, onDrop };
}

function Content({ boot }: { boot: BootState | null }) {
  if (!boot) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!boot.folder) return <Welcome recentFolders={boot.recentFolders} />;
  if (!boot.folderExists) return <FolderMissing folder={boot.folder} />;
  return <Workspace layout={boot.layout} />;
}

export function App() {
  const [boot, setBoot] = useState<BootState | null>(null);
  const { dropError, onDragOver, onDrop } = useFolderDrop();
  useAppCommands();

  useEffect(() => {
    void window.vision.app.getBootState().then((state) => {
      if (state.folder) {
        useWorkspace.setState({
          folder: state.folder,
          ...(state.layout ? { sidebarWidth: state.layout.sidebarWidth, sidebarCollapsed: state.layout.sidebarCollapsed, menuCollapsed: state.layout.menuCollapsed, showHidden: state.layout.showHidden } : {}),
        });
        document.title = state.folder;
      }
      setBoot(state);
    });
  }, []);

  return (
    <div className="relative h-full" onDragOver={onDragOver} onDrop={(event) => void onDrop(event)}>
      {!boot?.folderExists && <div className="drag-region absolute inset-x-0 top-0 h-(--title-bar-height)" />}
      <Content boot={boot} />
      {dropError && (
        <div className="card absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2" role="status">
          {dropError}
        </div>
      )}
    </div>
  );
}
