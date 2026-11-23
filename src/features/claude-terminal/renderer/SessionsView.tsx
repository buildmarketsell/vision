import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { PastConversation } from '../../../shared/claudeChat';
import { ClaudeLogo } from '../../../renderer/components/ClaudeLogo';
import { getDockApi, onDockReady } from '../../../renderer/core/dockActions';
import { CLAUDE_TAB, newClaudeSession, openConversation, useClaudeSessions } from './sessionsStore';
import { timeAgo } from './timeAgo';
import { UsagePanel } from './usage/UsagePanel';

const ICON = { size: 14, strokeWidth: 1.75 };

/** Which Claude tab is showing. */
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

/** The saved conversation in a tab. A new chat gets its id after the first reply, which also reloads the list. */
function conversationIn(panelId: string | null): string | null {
  const id = panelId ? (getDockApi()?.getPanel(panelId)?.params as { sessionId?: unknown } | undefined)?.sessionId : null;
  return typeof id === 'string' ? id : null;
}

/**
 * The folder's past conversations, newest first. Reloaded whenever a Claude tab
 * finishes a turn or is opened or closed, so new chats and new names show up.
 */
function usePastConversations(): PastConversation[] | null {
  const [past, setPast] = useState<PastConversation[] | null>(null);
  const activity = useClaudeSessions((state) => state.order.map((id) => `${id}:${state.sessions[id]?.busy ? 1 : 0}:${state.sessions[id]?.title}`).join('|'));
  useEffect(() => {
    let cancelled = false;
    void window.vision.chat.list().then((list) => !cancelled && setPast(list));
    return () => {
      cancelled = true;
    };
  }, [activity]);
  return past;
}

/** Sidebar view for Claude: usage on top, then past chats to pick up again. */
export function SessionsView() {
  const past = usePastConversations();
  const activeSessionId = conversationIn(useActiveClaudeTab());

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <UsagePanel />
      <div className="section-label">Past chats</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <button className="row w-full text-(--color-text-muted)" onClick={() => newClaudeSession()}>
          <span className="flex w-4 justify-center">
            <Plus {...ICON} />
          </span>
          New chat
          <span className="keycap ml-auto">⌘T</span>
        </button>
        {past === null && <div className="spinner" aria-label="Loading past chats" />}
        {past?.length === 0 && <div className="caption px-2 py-1">No past chats in this folder yet.</div>}
        {past?.map((item) => (
          <button
            key={item.sessionId}
            className="row w-full text-left"
            data-selected={item.sessionId === activeSessionId}
            title={item.title}
            onClick={() => openConversation(item)}
          >
            <span className="flex w-4 justify-center">
              <ClaudeLogo size={14} dim />
            </span>
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <span className="caption shrink-0">{timeAgo(item.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
