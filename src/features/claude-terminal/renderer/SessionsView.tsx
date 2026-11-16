import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ClaudeLogo } from '../../../renderer/components/ClaudeLogo';
import { closePanelById, focusPanel, onDockReady } from '../../../renderer/core/dockActions';
import { CLAUDE_TAB, newClaudeSession, useClaudeSessions, type ClaudeSession } from './sessionsStore';
import { focusClaudeTerminal } from './useClaudeTerminal';

const ICON = { size: 14, strokeWidth: 1.75 };

/** Which Claude tab is showing, so its row can be highlighted. */
function useActiveClaudeTab(): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    onDockReady((api) => {
      const update = () => {
        const panel = api.activePanel;
        if (panel && panel.view.contentComponent === CLAUDE_TAB) {
          setActiveId(panel.id);
          useClaudeSessions.getState().setLastActive(panel.id);
        } else {
          setActiveId(null);
        }
      };
      update();
      api.onDidActivePanelChange(update);
    });
  }, []);
  return activeId;
}

function SessionRow({ session, active }: { session: ClaudeSession; active: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group row"
      data-selected={active}
      aria-label={`Claude session ${session.title}`}
      onClick={() => {
        focusPanel(session.id);
        focusClaudeTerminal(session.id);
      }}
      onKeyDown={(event) => event.key === 'Enter' && focusPanel(session.id)}
    >
      <span className="flex w-4 justify-center">
        <ClaudeLogo size={15} busy={session.busy} dim={session.status !== 'running'} />
      </span>
      <span className="flex-1 truncate">{session.title}</span>
      <button
        className="icon-button opacity-0 group-hover:opacity-100 focus:opacity-100"
        style={{ width: 20, height: 20 }}
        aria-label={`Close ${session.title}`}
        title="Close session"
        onClick={(event) => {
          event.stopPropagation();
          closePanelById(session.id);
        }}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Sidebar section listing open Claude sessions, like the session list in Claude Code for VS Code. */
export function SessionsView() {
  const order = useClaudeSessions((state) => state.order);
  const sessions = useClaudeSessions((state) => state.sessions);
  const activeId = useActiveClaudeTab();

  return (
    <div className="flex max-h-[40%] shrink-0 flex-col">
      <div className="group flex items-center justify-between pr-2">
        <div className="section-label">Claude</div>
        <button
          className="icon-button opacity-0 group-hover:opacity-100 focus:opacity-100"
          style={{ width: 22, height: 22 }}
          title="New Claude session (⌘T)"
          aria-label="New Claude session"
          onClick={newClaudeSession}
        >
          <Plus {...ICON} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-1">
        {order.map((id) => {
          const session = sessions[id];
          return session ? <SessionRow key={id} session={session} active={id === activeId} /> : null;
        })}
        <button className="row w-full text-(--color-text-muted)" onClick={newClaudeSession}>
          <span className="flex w-4 justify-center">
            <Plus {...ICON} />
          </span>
          New session
          <span className="keycap ml-auto">⌘T</span>
        </button>
      </div>
    </div>
  );
}
