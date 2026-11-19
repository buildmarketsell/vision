import { useEffect, useRef } from 'react';
import type { FolderLayout } from '../../shared/ipc';
import { Dock } from '../core/Dock';
import { useWorkspace } from '../core/workspaceStore';
import { FeatureMenu } from './FeatureMenu';
import { Sidebar } from './Sidebar';
import { useActiveView } from './SidebarViews';
import { ErrorBoundary } from './ErrorBoundary';
import { allSidebarViews } from '../core/featureIndex';

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
      const { sidebarWidth, sidebarCollapsed, menuCollapsed, showHidden } = useWorkspace.getState();
      window.vision.app.saveLayout({ dock: dockRef.current, sidebarWidth, sidebarCollapsed, menuCollapsed, showHidden });
    }, SAVE_LAYOUT_DELAY_MS);
  };

  useEffect(() => {
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      const changed =
        state.sidebarWidth !== previous.sidebarWidth ||
        state.sidebarCollapsed !== previous.sidebarCollapsed ||
        state.menuCollapsed !== previous.menuCollapsed ||
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
  const sidebarCollapsed = useWorkspace((state) => state.sidebarCollapsed);
  const menuCollapsed = useWorkspace((state) => state.menuCollapsed);
  // Hidden panels leave room in the top row for the traffic lights and the buttons that bring them back.
  const mainClass = `min-w-0 flex-1 ${menuCollapsed ? 'menu-collapsed' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`;
  const views = allSidebarViews();
  const [activeView] = useActiveView(views);
  const takeoverView = views.find((view) => view.id === activeView);
  const Takeover = takeoverView?.main;

  return (
    <div className="relative flex h-full">
      <FeatureMenu />
      {/* The panes stay mounted while a view takes over, so Claude chats and terminals keep running. */}
      <main className={mainClass} hidden={Boolean(Takeover)}>
        <Dock savedLayout={layout?.dock ?? null} onLayoutChange={onLayoutChange} />
      </main>
      {Takeover && (
        <main className={`${mainClass} flex flex-col`}>
          {!takeoverView?.ownTopBar && <div className="drag-region h-(--title-bar-height) shrink-0" />}
          <ErrorBoundary name="Page">
            <Takeover />
          </ErrorBoundary>
        </main>
      )}
      <Sidebar />
    </div>
  );
}
