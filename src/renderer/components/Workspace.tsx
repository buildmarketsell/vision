import { useEffect, useRef } from 'react';
import type { FolderLayout } from '../../shared/ipc';
import { Dock } from '../core/Dock';
import { useWorkspace } from '../core/workspaceStore';
import { Sidebar, SidebarToggle } from './Sidebar';

const SAVE_LAYOUT_DELAY_MS = 500;

/** Watches exactly what features asked for (expanded folders, open files). */
function useWatchSync(): void {
  useEffect(() => {
    let last = '';
    return useWorkspace.subscribe((state) => {
      const paths = [...new Set(Object.values(state.watchedByFeature).flat())].sort();
      const key = paths.join('\n');
      if (key === last) return;
      last = key;
      window.vision.fs.watch(paths);
    });
  }, []);
}

/** Saves the pane layout and sidebar state for this folder, shortly after each change. */
function useLayoutSaver(initialDock: unknown) {
  const dockRef = useRef<unknown>(initialDock);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { sidebarWidth, sidebarCollapsed, showHidden } = useWorkspace.getState();
      window.vision.app.saveLayout({ dock: dockRef.current, sidebarWidth, sidebarCollapsed, showHidden });
    }, SAVE_LAYOUT_DELAY_MS);
  };

  useEffect(() => {
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      const changed =
        state.sidebarWidth !== previous.sidebarWidth ||
        state.sidebarCollapsed !== previous.sidebarCollapsed ||
        state.showHidden !== previous.showHidden;
      if (changed) scheduleSave();
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (dock: unknown) => {
    dockRef.current = dock;
    scheduleSave();
  };
}

export function Workspace({ layout }: { layout: FolderLayout | null }) {
  useWatchSync();
  const onLayoutChange = useLayoutSaver(layout?.dock ?? null);
  const collapsed = useWorkspace((state) => state.sidebarCollapsed);

  return (
    <div className="relative flex h-full">
      <Sidebar />
      <SidebarToggle />
      <main className={`min-w-0 flex-1 ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Dock savedLayout={layout?.dock ?? null} onLayoutChange={onLayoutChange} />
      </main>
    </div>
  );
}
