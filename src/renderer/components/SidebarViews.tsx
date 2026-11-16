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
  const activeIndex = Math.max(0, views.findIndex((view) => view.id === active));
  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="view-tray">
        <div role="tablist" aria-label="Sidebar views" className="view-bar">
          <span
            className="view-indicator"
            aria-hidden
            style={{ transform: `translateX(calc(${activeIndex} * (var(--view-button) + var(--view-gap))))` }}
          >
            <span className="view-ring" />
            <span className="view-gap" />
            <span className="view-face" />
          </span>
          {views.map((view) => (
            <button
              key={view.id}
              role="tab"
              id={`view-tab-${view.id}`}
              aria-controls={`view-${view.id}`}
              aria-selected={view.id === active}
              aria-label={view.title}
              title={view.title}
              className="view-tab"
              onClick={() => onSelect(view.id)}
            >
              {view.icon}
            </button>
          ))}
        </div>
      </div>
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
