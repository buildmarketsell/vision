import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from 'dockview-react';
import type { TabParams } from './feature';
import { allDefaultPanels, findTabType, tabTypeForFile } from './featureIndex';
import { baseName } from './workspaceStore';

let dockApi: DockviewApi | null = null;
const readyListeners: Array<(api: DockviewApi) => void> = [];

export function setDockApi(api: DockviewApi | null): void {
  dockApi = api;
  if (api) for (const listener of readyListeners) listener(api);
}

/** Runs `listener` with the dock once it exists (right away if it already does). */
export function onDockReady(listener: (api: DockviewApi) => void): void {
  readyListeners.push(listener);
  if (dockApi) listener(dockApi);
}

export function getDockApi(): DockviewApi | null {
  return dockApi;
}

export function fileTabId(path: string): string {
  return `file:${path}`;
}

function tabTypeOf(panel: IDockviewPanel): string {
  return panel.view.contentComponent;
}

/** Tab types like Claude keep to their own pane; files don't open next to them. */
function keepsOwnGroup(panel: IDockviewPanel): boolean {
  return findTabType(tabTypeOf(panel))?.ownGroup === true;
}

function groupIsForFiles(group: DockviewGroupPanel): boolean {
  return !group.panels.some(keepsOwnGroup);
}

/** Files open in the active pane, or the first pane that isn't Claude's. */
function targetGroupForFiles(api: DockviewApi): DockviewGroupPanel | undefined {
  const active = api.activeGroup;
  if (active && groupIsForFiles(active)) return active;
  return api.groups.find(groupIsForFiles);
}

export function openFile(path: string): void {
  const api = dockApi;
  const tabType = tabTypeForFile(path);
  if (!api || !tabType) return;
  const id = fileTabId(path);
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const params: TabParams = { path };
  const group = targetGroupForFiles(api);
  const sidePanel = api.panels.find(keepsOwnGroup);
  const base = { id, component: tabType, title: baseName(path), params, renderer: 'always' as const };
  if (group) api.addPanel({ ...base, position: { referenceGroup: group } });
  else if (sidePanel) api.addPanel({ ...base, position: { referencePanel: sidePanel, direction: 'left' } });
  else api.addPanel(base);
}

/**
 * Opens a tab of a type that keeps its own pane (like Claude): next to its siblings,
 * or in a new pane on the right.
 */
export function openOwnGroupPanel(tabType: string, id: string, title: string, params: TabParams = {}): void {
  const api = dockApi;
  if (!api) return;
  const sibling = api.panels.find((panel) => tabTypeOf(panel) === tabType);
  const base = { id, component: tabType, title, params, renderer: 'always' as const };
  if (sibling) api.addPanel({ ...base, position: { referenceGroup: sibling.group } });
  else if (api.groups[0]) api.addPanel({ ...base, position: { referenceGroup: api.groups[0], direction: 'right' } });
  else api.addPanel(base);
}

/** Closes a tab after asking its feature (e.g. "Close without saving?"). */
export async function requestClosePanel(panel: IDockviewPanel | undefined): Promise<void> {
  if (!panel) return;
  const tabType = findTabType(tabTypeOf(panel));
  if (!tabType || !tabType.closable) return;
  const params = (panel.params ?? {}) as TabParams;
  if (tabType.canClose && !(await tabType.canClose(params))) return;
  panel.api.close();
  tabType.onClosed?.(params);
}

export function closeActivePanel(): void {
  void requestClosePanel(dockApi?.activePanel);
}

export function closePanelById(id: string): void {
  void requestClosePanel(dockApi?.getPanel(id));
}

/** Params of the active tab when it is of the given type. */
export function activeParams(tabType: string): TabParams | null {
  const panel = dockApi?.activePanel;
  if (!panel || tabTypeOf(panel) !== tabType) return null;
  return (panel.params ?? {}) as TabParams;
}

export function focusPanel(id: string): void {
  dockApi?.getPanel(id)?.api.setActive();
}

export function setPanelTitle(id: string, title: string): void {
  const panel = dockApi?.getPanel(id);
  if (panel && panel.title !== title) panel.api.setTitle(title);
}

/** Closes the tab of a file without asking (used after the file was deleted or renamed). */
export function closeFileTab(path: string): void {
  const panel = dockApi?.getPanel(fileTabId(path));
  if (!panel) return;
  const params = (panel.params ?? {}) as TabParams;
  panel.api.close();
  findTabType(tabTypeOf(panel))?.onClosed?.(params);
}

/** First launch in a folder: open the default tabs (one Claude session). */
export function openDefaultPanels(): void {
  for (const panel of allDefaultPanels()) {
    if (!dockApi?.getPanel(panel.id)) openOwnGroupPanel(panel.tabType, panel.id, panel.title);
  }
}
