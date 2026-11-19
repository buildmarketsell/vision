import type { ComponentType, FunctionComponent, ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

/** Parameters stored with a tab (saved in the layout, so keep them plain JSON). */
export type TabParams = Record<string, string>;

/** A feature in the menu on the left; picking it shows its panel in the sidebar on the right. One at a time, in registry order. */
export interface SidebarView {
  id: string;
  title: string;
  icon: ReactNode;
  /** The panel in the sidebar on the right. Without one, the sidebar steps aside while this view is open. */
  component?: ComponentType;
  /** Shown instead of the panes while this view is open (Notion mode). The panes stay alive underneath. */
  main?: ComponentType;
  /** Hides the sidebar's Claude button row while this view is open (the view draws its own). */
  ownBottomBar?: boolean;
  /** The `main` page draws its own top row; otherwise it gets an empty one for the traffic lights and panel buttons. */
  ownTopBar?: boolean;
  /** Not in the menu: a button at the bottom of the sidebar opens it (Usage). */
  inSidebar?: boolean;
  /** Sits at the bottom of the menu, like Notion's Settings. */
  pinBottom?: boolean;
}

export interface TabType {
  id: string;
  component: FunctionComponent<IDockviewPanelProps<TabParams>>;
  /** False for tabs that can't be closed, only moved. */
  closable: boolean;
  /** Tabs like Claude keep to their own pane: files never open next to them. */
  ownGroup?: boolean;
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

/** A tab opened the first time a folder is opened (no saved layout yet). */
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
