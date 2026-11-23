import { ClaudeLogo } from '../components/ClaudeLogo';
import { TopoBackground } from '../components/topo/TopoBackground';
import { runCommand } from './commands';

/** Shown when every tab is closed: a contour map with one button to start a Claude chat (Dan, 2026-11-23). */
export function EmptyDock() {
  return (
    <div className="empty-dock">
      <div className="empty-dock-top drag-region" />
      <TopoBackground>
        <button type="button" className="button-primary empty-dock-start" onClick={() => runCommand('claude.new')}>
          <ClaudeLogo size={16} />
          New Claude chat
          <kbd className="empty-dock-key">⌘T</kbd>
        </button>
      </TopoBackground>
    </div>
  );
}
