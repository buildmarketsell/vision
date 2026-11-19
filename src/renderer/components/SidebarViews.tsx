import type { SidebarView } from '../core/feature';
import { ErrorBoundary } from './ErrorBoundary';
import { useActiveViewStore } from '../core/activeView';

/** Which sidebar view shows, remembered across launches. Falls back to the first view. */
export function useActiveView(views: SidebarView[]): [string, (id: string) => void] {
  const { stored, select } = useActiveViewStore();
  const active = views.some((view) => view.id === stored) ? stored : views[0]?.id;
  return [active ?? '', select];
}

function ViewComponent({ view }: { view: SidebarView }) {
  const Component = view.component;
  return Component ? <Component /> : null;
}

/** Every view stays mounted (the tree keeps its folders open, Claude keeps tracking usage); only the active one shows. */
export function ViewPanels({ views, active }: { views: SidebarView[]; active: string }) {
  return (
    <>
      {views.map((view) => view.component && (
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
            <ViewComponent view={view} />
          </ErrorBoundary>
        </section>
      ))}
    </>
  );
}
