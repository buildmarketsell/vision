import type { SidebarView } from '../core/feature';
import { ErrorBoundary } from './ErrorBoundary';
import { useActiveViewStore } from '../core/activeView';

/** Which sidebar view shows, remembered across launches. Falls back to the first view. */
export function useActiveView(views: SidebarView[]): [string, (id: string) => void] {
  const { stored, select } = useActiveViewStore();
  const active = views.some((view) => view.id === stored) ? stored : views[0]?.id;
  return [active ?? '', select];
}

/** Notion-style row of plain icons; the open view sits on a soft gray square. Icons only, so more views still fit. */
export function ViewSwitcher({ views, active, onSelect }: { views: SidebarView[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Sidebar views" className="view-row">
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
