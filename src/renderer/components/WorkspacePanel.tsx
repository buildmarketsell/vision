import { create } from 'zustand';
import { allWorkspaceTabs } from '../core/featureIndex';
import { ErrorBoundary } from './ErrorBoundary';

const KEY = 'vision.workspaceTab';

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The Workspace panel's open tab (Files, Claude, Calendar), remembered across launches. */
const useWorkspaceTab = create<{ stored: string | null; select: (id: string) => void }>((set) => ({
  stored: readStored(),
  select: (id) => {
    set({ stored: id });
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Not remembering the tab is fine; it still switches.
    }
  },
}));

function useActiveTab(): [string, (id: string) => void] {
  const { stored, select } = useWorkspaceTab();
  const tabs = allWorkspaceTabs();
  return [tabs.some((tab) => tab.id === stored) ? (stored as string) : (tabs[0]?.id ?? ''), select];
}

/** Workspace's top row: one plain icon per tab, the open one on a soft gray square (VS Code / Cursor style). */
export function WorkspaceTabStrip() {
  const [active, select] = useActiveTab();
  return (
    <div role="tablist" aria-label="Workspace" className="ws-tabs">
      {allWorkspaceTabs().map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`ws-tab-${tab.id}`}
          aria-controls={`ws-${tab.id}`}
          aria-selected={tab.id === active}
          aria-label={tab.title}
          title={tab.title}
          className="ws-tab"
          onClick={() => select(tab.id)}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}

/** Every tab stays mounted (the file tree keeps its open folders, Claude keeps tracking usage); only the open one shows. */
export function WorkspacePanel() {
  const [active] = useActiveTab();
  return (
    <>
      {allWorkspaceTabs().map((tab) => (
        <section
          key={tab.id}
          role="tabpanel"
          id={`ws-${tab.id}`}
          aria-labelledby={`ws-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="min-h-0 flex-1 flex-col"
          style={{ display: tab.id === active ? 'flex' : 'none' }}
        >
          <ErrorBoundary name={tab.title}>
            <tab.component />
          </ErrorBoundary>
        </section>
      ))}
    </>
  );
}
