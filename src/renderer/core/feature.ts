import type { ComponentType, FunctionComponent, ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

/** Parameters stored with a tab (saved in the layout, so keep them plain JSON). */
export type TabParams = Record<string, string>;

export interface SidebarView {
  id: string;
  title: string;
  component: ComponentType;
}

export interface TabType {
  id: string;
  component: FunctionComponent<IDockviewPanelProps<TabParams>>;
  /** Tabs that can't be closed (only moved), like Claude. */
  closable: boolean;
  /** Small icon shown in the tab. */
  icon?: (params: TabParams) => ReactNode;
  /** Asked before the tab closes; return false to keep it open. */
  canClose?: (params: TabParams) => Promise<boolean>;
  /** Called after the tab closed. */
  onClosed?: (params: TabParams) => void;
}

/** Which tab type opens a file. The first feature whose `matches` returns true wins. */
export interface FileHandler {
  tabType: string;
  matches: (path: string) => boolean;
}

/** A tab that always exists, created on first launch and after a layout restore. */
export interface DefaultPanel {
  id: string;
  tabType: string;
  title: string;
}

export interface Command {
  id: string;
  title: string;
  /** e.g. "Mod+S", "Mod+Shift+." (Mod is Cmd on macOS). */
  shortcut?: string;
  run: () => void | Promise<void>;
}

export interface Feature {
  id: string;
  name: string;
  sidebarViews?: SidebarView[];
  tabTypes?: TabType[];
  fileHandlers?: FileHandler[];
  defaultPanels?: DefaultPanel[];
  commands?: Command[];
}
