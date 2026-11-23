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
  /** Replaces the folder name in the sidebar's top row while this view is open (Workspace's tabs). */
  header?: ComponentType;
  /** Sits at the bottom of the menu, like Notion's Settings. */
  pinBottom?: boolean;
}

/** A tab in the Workspace panel's top row (Files, Claude, Calendar), like VS Code's sidebar tabs. */
export interface WorkspaceTab {
  id: string;
  title: string;
  icon: ReactNode;
  component: ComponentType;
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

/** One result in the ⌘K search box. */
export interface SearchItem {
  id: string;
  title: string;
  /** Muted text after the title, e.g. a file's folder. */
  detail?: string;
  /** What it is, shown on the right: "File", "Chat", "Page"… */
  kind: string;
  icon?: ReactNode;
  run: () => void;
}

/** A feature's own results in the ⌘K search box, shown under `title`. Called as Dan types (debounced). */
export interface SearchProvider {
  id: string;
  title: string;
  search: (query: string) => Promise<SearchItem[]>;
}

/** A card a feature puts on the Dashboard; Dan picks which show and in what order. */
export interface DashboardCard {
  id: string;
  title: string;
  icon: ReactNode;
  /** The card's body; the Dashboard draws the frame and title. */
  component: ComponentType;
  /** The menu view the title opens ("todo", "calendar"…). */
  view?: string;
  /** Takes the whole row. */
  wide?: boolean;
}

export interface Feature {
  id: string;
  name: string;
  sidebarViews?: SidebarView[];
  workspaceTabs?: WorkspaceTab[];
  tabTypes?: TabType[];
  fileHandlers?: FileHandler[];
  defaultPanels?: DefaultPanel[];
  commands?: Command[];
  searchProviders?: SearchProvider[];
  dashboardCards?: DashboardCard[];
}
