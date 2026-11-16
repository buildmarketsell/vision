import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from 'dockview-react';
import type { TabParams } from './feature';
import { allDefaultPanels, findTabType, tabTypeForFile } from './featureIndex';
import { baseName } from './workspaceStore';

let dockApi: DockviewApi | null = null;

export function setDockApi(api: DockviewApi | null): void {
  dockApi = api;
}

export function getDockApi(): DockviewApi | null {
  return dockApi;
}

export function fileTabId(path: string): string {
  return `file:${path}`;
}

function isPinnedPanel(panel: IDockviewPanel): boolean {
  return findTabType(panel.view.contentComponent)?.closable === false;
}

function groupHasPinnedPanel(group: DockviewGroupPanel): boolean {
  return group.panels.some(isPinnedPanel);
}

/** Files open in the active group, or the first group without a pinned tab like Claude. */
function targetGroupForFiles(api: DockviewApi): DockviewGroupPanel | undefined {
  const active = api.activeGroup;
  if (active && !groupHasPinnedPanel(active)) return active;
  return api.groups.find((group) => !groupHasPinnedPanel(group));
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
  const pinned = api.panels.find(isPinnedPanel);
  const base = { id, component: tabType, title: baseName(path), params, renderer: 'always' as const };
  if (group) api.addPanel({ ...base, position: { referenceGroup: group } });
  else if (pinned) api.addPanel({ ...base, position: { referencePanel: pinned, direction: 'left' } });
  else api.addPanel(base);
}

/** Closes a tab after asking its feature (e.g. "Close without saving?"). Pinned tabs stay. */
export async function requestClosePanel(panel: IDockviewPanel | undefined): Promise<void> {
  if (!panel) return;
  const tabType = findTabType(panel.view.contentComponent);
  if (!tabType || !tabType.closable) return;
  const params = (panel.params ?? {}) as TabParams;
  if (tabType.canClose && !(await tabType.canClose(params))) return;
  panel.api.close();
  tabType.onClosed?.(params);
}

export function closeActivePanel(): void {
  void requestClosePanel(dockApi?.activePanel);
}

/** Params of the active tab when it is of the given type. */
export function activeParams(tabType: string): TabParams | null {
  const panel = dockApi?.activePanel;
  if (!panel || panel.view.contentComponent !== tabType) return null;
  return (panel.params ?? {}) as TabParams;
}

export function focusPanel(id: string): void {
  dockApi?.getPanel(id)?.api.setActive();
}

/** Closes the tab of a file without asking (used after the file was deleted or renamed). */
export function closeFileTab(path: string): void {
  const panel = dockApi?.getPanel(fileTabId(path));
  if (!panel) return;
  const params = (panel.params ?? {}) as TabParams;
  panel.api.close();
  findTabType(panel.view.contentComponent)?.onClosed?.(params);
}

/** Makes sure tabs like Claude exist, on the right side. */
export function ensureDefaultPanels(): void {
  const api = dockApi;
  if (!api) return;
  for (const panel of allDefaultPanels()) {
    if (api.getPanel(panel.id)) continue;
    const firstGroup = api.groups[0];
    api.addPanel({
      id: panel.id,
      component: panel.tabType,
      title: panel.title,
      renderer: 'always',
      ...(firstGroup ? { position: { referenceGroup: firstGroup, direction: 'right' as const } } : {}),
    });
  }
}
