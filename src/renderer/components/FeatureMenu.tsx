import { PanelLeft } from 'lucide-react';
import type { SidebarView } from '../core/feature';
import { allSidebarViews } from '../core/featureIndex';
import { usePeek } from '../core/usePeek';
import { useWorkspace } from '../core/workspaceStore';
import { useActiveView } from './SidebarViews';

function MenuRow({ view, active, onSelect }: { view: SidebarView; active: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      role="tab"
      id={`view-tab-${view.id}`}
      aria-controls={`view-${view.id}`}
      aria-selected={active}
      className="menu-row"
      onClick={() => onSelect(view.id)}
    >
      <span className="menu-row-icon" aria-hidden>
        {view.icon}
      </span>
      <span className="truncate">{view.title}</span>
    </button>
  );
}

/**
 * Every feature of VISION as a Notion-style list, flush left under the traffic lights; picking one
 * shows its panel on the right. Hidden with its button or ⌘\; then hovering the left edge slides it out.
 */
export function FeatureMenu() {
  const collapsed = useWorkspace((state) => state.menuCollapsed);
  const views = allSidebarViews();
  const [activeView, selectView] = useActiveView(views);
  const peek = usePeek(collapsed);
  const label = collapsed ? 'Show menu' : 'Hide menu';
  const row = (view: SidebarView) => <MenuRow key={view.id} view={view} active={view.id === activeView} onSelect={selectView} />;

  return (
    <>
      {collapsed && <div className="edge-zone" data-side="left" aria-hidden onPointerEnter={peek.show} onPointerLeave={peek.hideSoon} />}
      <aside
        className="feature-menu side-panel"
        data-side="left"
        data-collapsed={collapsed}
        data-peeking={peek.peeking}
        aria-label="Menu"
        inert={collapsed && !peek.peeking}
        onPointerEnter={peek.show}
        onPointerLeave={peek.hideSoon}
      >
        <div className="side-panel-top drag-region h-(--title-bar-height) shrink-0" />
        <div role="tablist" aria-orientation="vertical" aria-label="Features" className="menu-list">
          {views.filter((view) => !view.pinBottom).map(row)}
          <div className="flex-1" />
          {views.filter((view) => view.pinBottom).map(row)}
        </div>
      </aside>
      <button
        className="icon-button panel-toggle no-drag"
        data-side="left"
        title={`${label} (⌘\\)`}
        aria-label={label}
        aria-expanded={!collapsed}
        onClick={() => {
          peek.hide();
          useWorkspace.getState().toggleMenu();
        }}
        onPointerEnter={peek.show}
        onPointerLeave={peek.hideSoon}
      >
        <PanelLeft size={16} strokeWidth={1.5} color="var(--color-text-muted)" />
      </button>
    </>
  );
}
