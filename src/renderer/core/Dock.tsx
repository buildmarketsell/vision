import { useMemo, type FunctionComponent } from 'react';
import { DockviewReact, themeLight, type DockviewApi, type DockviewReadyEvent, type DockviewTheme, type IDockviewPanelProps } from 'dockview-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { theme } from '../theme';
import type { TabParams } from './feature';
import { allTabTypes } from './featureIndex';
import { openDefaultPanels, setDockApi } from './dockActions';
import { PanelTab } from './PanelTab';

const visionTheme: DockviewTheme = {
  ...themeLight,
  name: 'vision',
  className: `${themeLight.className} vision-dock`,
  gap: theme.layout.gap,
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

function restoreLayout(api: DockviewApi, saved: unknown): void {
  if (!saved) return;
  try {
    api.fromJSON(saved as Parameters<DockviewApi['fromJSON']>[0]);
  } catch (error) {
    console.warn('Saved layout could not be restored, starting fresh.', error);
    api.clear();
  }
}

interface DockProps {
  savedLayout: unknown;
  onLayoutChange: (layout: unknown) => void;
}

/** The main area: panes with tabs that can be split and dragged, one card per pane. */
export function Dock({ savedLayout, onLayoutChange }: DockProps) {
  const components = useMemo(
    () => Object.fromEntries(allTabTypes().map((tabType) => [tabType.id, withBoundary(tabType.id, tabType.component)])),
    [],
  );

  const onReady = ({ api }: DockviewReadyEvent) => {
    setDockApi(api);
    restoreLayout(api, savedLayout);
    if (api.panels.length === 0) openDefaultPanels();
    api.onDidLayoutChange(() => onLayoutChange(api.toJSON()));
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
