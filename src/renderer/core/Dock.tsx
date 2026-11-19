import { useMemo, type FunctionComponent } from 'react';
import { DockviewReact, themeLight, type DockviewApi, type DockviewReadyEvent, type DockviewTheme, type IDockviewPanelProps } from 'dockview-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TabParams } from './feature';
import { allSidebarViews, allTabTypes } from './featureIndex';
import { useActiveViewStore } from './activeView';
import { openDefaultPanels, setDockApi } from './dockActions';
import { PanelTab } from './PanelTab';

const visionTheme: DockviewTheme = {
  ...themeLight,
  name: 'vision',
  className: `${themeLight.className} vision-dock`,
  gap: 0,
};

type PanelComponent = FunctionComponent<IDockviewPanelProps<TabParams>>;

function withBoundary(name: string, Inner: PanelComponent): PanelComponent {
  const Wrapped: PanelComponent = (props) => (
    <ErrorBoundary name={name}>
      <Inner {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Panel(${name})`;
  return Wrapped;
}

function showPanes(): void {
  const views = allSidebarViews();
  const { stored, select } = useActiveViewStore.getState();
  if (!views.find((view) => view.id === stored)?.main) return;
  const panesView = views.find((view) => !view.main);
  if (panesView) select(panesView.id);
}

function restoreLayout(api: DockviewApi, saved: unknown): void {
  if (!saved) return;
  try {
    api.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]);
  } catch (error) {
    console.warn('Saved layout could not be restored, starting fresh.', error);
    api.clear();
  }
}

/**
 * Marks the top-left pane: when the sidebar is hidden, its tab strip leaves room for the
 * traffic lights and the sidebar button. Dockview has no "position" class, so it is measured.
 */
function markCornerGroup(api: DockviewApi): void {
  let corner: HTMLElement | null = null;
  let best = { top: Infinity, left: Infinity };
  for (const group of api.groups) {
    const { top, left } = group.element.getBoundingClientRect();
    if (top < best.top - 1 || (Math.abs(top - best.top) <= 1 && left < best.left)) {
      best = { top, left };
      corner = group.element;
    }
  }
  for (const group of api.groups) group.element.classList.toggle('dock-corner', group.element === corner);
}

interface DockProps {
  savedLayout: unknown;
  onLayoutChange: (layout: unknown) => void;
}

/** The main area: panes with tabs that can be split and dragged, separated by thin lines. */
export function Dock({ savedLayout, onLayoutChange }: DockProps) {
  const components = useMemo(
    () => Object.fromEntries(allTabTypes().map((tabType) => [tabType.id, withBoundary(tabType.id, tabType.component)])),
    [],
  );

  const onReady = ({ api }: DockviewReadyEvent) => {
    setDockApi(api);
    restoreLayout(api, savedLayout);
    if (api.panels.length === 0) openDefaultPanels();
    markCornerGroup(api);
    // A tab opened while a view covers the panes (⌘T in Notion mode) must not open out of sight.
    api.onDidAddPanel(showPanes);
    api.onDidLayoutChange(() => {
      markCornerGroup(api);
      onLayoutChange(api.toJSON());
    });
  };

  return (
    <DockviewReact
      className="vision-dock"
      theme={visionTheme}
      components={components as Record<string, FunctionComponent<IDockviewPanelProps>>}
      defaultTabComponent={PanelTab as FunctionComponent}
      onReady={onReady}
      disableFloatingGroups
    />
  );
}
