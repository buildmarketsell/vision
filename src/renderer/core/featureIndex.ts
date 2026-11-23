import { registerCommands } from './commands';
import type { DefaultPanel, Feature, SearchProvider, SidebarView, TabType, WorkspaceTab } from './feature';

let installed: Feature[] = [];

/** Called once at startup with the list from src/features/registry.ts. */
export function installFeatures(features: Feature[]): void {
  installed = features;
  registerCommands(features.flatMap((feature) => feature.commands ?? []));
}

export function allTabTypes(): TabType[] {
  return installed.flatMap((feature) => feature.tabTypes ?? []);
}

export function findTabType(id: string): TabType | undefined {
  return allTabTypes().find((tabType) => tabType.id === id);
}

export function tabTypeForFile(path: string): string | undefined {
  const handlers = installed.flatMap((feature) => feature.fileHandlers ?? []);
  return handlers.find((handler) => handler.matches(path))?.tabType;
}

export function allSidebarViews(): SidebarView[] {
  return installed.flatMap((feature) => feature.sidebarViews ?? []);
}

export function allWorkspaceTabs(): WorkspaceTab[] {
  return installed.flatMap((feature) => feature.workspaceTabs ?? []);
}

export function allDefaultPanels(): DefaultPanel[] {
  return installed.flatMap((feature) => feature.defaultPanels ?? []);
}

export function allSearchProviders(): SearchProvider[] {
  return installed.flatMap((feature) => feature.searchProviders ?? []);
}
