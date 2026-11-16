import { useState } from 'react';
import type { SidebarView } from '../core/feature';
import { ErrorBoundary } from './ErrorBoundary';

const ACTIVE_VIEW_KEY = 'vision.sidebarView';

function readStoredView(): string | null {
  try {
    return localStorage.getItem(ACTIVE_VIEW_KEY);
  } catch {
    return null;
  }
}

/** Which sidebar view shows, remembered across launches. Falls back to the first view. */
export function useActiveView(views: SidebarView[]): [string, (id: string) => void] {
  const [stored, setStored] = useState(readStoredView);
  const active = views.some((view) => view.id === stored) ? stored : views[0]?.id;
  const select = (id: string) => {
    setStored(id);
    try {
      localStorage.setItem(ACTIVE_VIEW_KEY, id);
    } catch {
      // Not remembering the view is fine; it still switches.
    }
  };
  return [active ?? '', select];
}

export function ViewSwitcher({ views, active, onSelect }: { views: SidebarView[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Sidebar views" className="flex shrink-0 items-center gap-1 px-2 pb-1">
      {views.map((view) => {
        const selected = view.id === active;
        return (
          <button
            key={view.id}
            role="tab"
            id={`view-tab-${view.id}`}
            aria-controls={`view-${view.id}`}
            aria-selected={selected}
            aria-label={view.title}
            title={view.title}
            className="view-tab"
            onClick={() => onSelect(view.id)}
          >
            {view.icon}
            {selected && <span aria-hidden>{view.title}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Every view stays mounted (the tree keeps its folders open, Claude keeps tracking usage); only the active one shows. */
export function ViewPanels({ views, active }: { views: SidebarView[]; active: string }) {
  return (
    <>
      {views.map((view) => (
        <section
          key={view.id}
          role="tabpanel"
          id={`view-${view.id}`}
          aria-labelledby={`view-tab-${view.id}`}
          hidden={view.id !== active}
          className="min-h-0 flex-1 flex-col"
          style={{ display: view.id === active ? 'flex' : 'none' }}
        >
          <ErrorBoundary name={view.title}>
            <view.component />
          </ErrorBoundary>
        </section>
      ))}
    </>
  );
}
