import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DockviewPanelApi, IDockviewPanelProps } from 'dockview-react';
import { MessageSquare, Moon, RotateCw, SquareTerminal, Sun } from 'lucide-react';
import { DEFAULT_PERMISSION_MODE, isSessionId, PERMISSION_MODES, type PermissionMode } from '../../../shared/claudeChat';
import { ClaudeLogo } from '../../../renderer/components/ClaudeLogo';
import { setPanelTitle } from '../../../renderer/core/dockActions';
import type { TabParams } from '../../../renderer/core/feature';
import { ChatView } from './chat/ChatView';
import { useChatSession, type ChatSession } from './chat/useChatSession';
import { DEFAULT_TITLE, useClaudeSessions, type ClaudeSession } from './sessionsStore';
import { useClaudeTerminal, type ClaudeStatus } from './useClaudeTerminal';
import { useTerminalTheme } from '../../../renderer/core/terminalTheme';

type ViewMode = 'chat' | 'terminal';
const TITLE_FROM_MESSAGE_CHARS = 48;

function statusLabel(session: ClaudeSession | undefined): string {
  if (!session || session.status === 'starting') return 'Starting';
  if (session.status === 'failed') return 'Did not start';
  if (session.status === 'stopped') return 'Stopped';
  if (session.waiting) return 'Needs you';
  return session.busy ? 'Working' : 'Ready';
}

/** Status pill: pulsing orange while Claude works or needs you, calm gray otherwise. */
function StatusPill({ session }: { session: ClaudeSession | undefined }) {
  const active = session?.status === 'running' && (session.busy || session.waiting);
  return (
    <span
      className="caption flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5"
      style={{ background: active ? 'var(--color-accent-soft)' : 'var(--color-row-hover)', color: active ? 'var(--color-accent-hover)' : undefined }}
    >
      {session?.status === 'running' && <span className="live-dot" data-busy={active} />}
      {statusLabel(session)}
    </span>
  );
}

function ModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="segmented" role="tablist" aria-label="View">
      <button role="tab" aria-selected={mode === 'chat'} data-active={mode === 'chat'} onClick={() => onChange('chat')}>
        <MessageSquare size={13} strokeWidth={1.75} /> Chat
      </button>
      <button role="tab" aria-selected={mode === 'terminal'} data-active={mode === 'terminal'} onClick={() => onChange('terminal')}>
        <SquareTerminal size={13} strokeWidth={1.75} /> Terminal
      </button>
    </div>
  );
}

/** Sun in dark mode (tap for light), moon in light mode (tap for dark). */
function AppearanceButton() {
  const { appearance, toggle } = useTerminalTheme();
  const label = appearance === 'dark' ? 'Light terminal' : 'Dark terminal';
  return (
    <button className="icon-button" title={label} aria-label={label} onClick={toggle}>
      {appearance === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
    </button>
  );
}

function setTitle(panelId: string, title: string): void {
  useClaudeSessions.getState().update(panelId, { title });
  setPanelTitle(panelId, title);
}

/** Keeps the sidebar list, the tab title and the saved tab parameters in step with the chat. */
function useChatSync(panel: DockviewPanelApi, chat: ChatSession): void {
  const { state } = chat;
  const waiting = state.permissions.length > 0 || state.questions.length > 0;
  const firstMessage = state.items.find((item) => item.kind === 'user');

  useEffect(() => {
    const status = state.phase === 'stopped' ? 'stopped' : state.phase === 'starting' ? 'starting' : 'running';
    useClaudeSessions.getState().update(panel.id, { status, busy: state.phase === 'working' && !waiting, waiting });
  }, [panel.id, state.phase, waiting]);

  useEffect(() => {
    if (firstMessage?.kind !== 'user') return;
    const current = useClaudeSessions.getState().sessions[panel.id]?.title;
    if (!current || current === DEFAULT_TITLE) setTitle(panel.id, firstMessage.text.replace(/\s+/g, ' ').slice(0, TITLE_FROM_MESSAGE_CHARS));
  }, [panel.id, firstMessage]);

  // Claude's name for a new chat, asked for with the first message. The first words above stand in until it arrives.
  const aiTitle = state.info.aiTitle;
  useEffect(() => {
    if (aiTitle) setTitle(panel.id, aiTitle);
  }, [panel.id, aiTitle]);

  // A resumed chat: after each turn, use the name saved with the conversation (unless Claude just named it).
  useEffect(() => {
    const sessionId = state.sessionId;
    if (state.phase !== 'idle' || !sessionId || aiTitle) return;
    void window.vision.chat.list().then((past) => {
      const title = past.find((item) => item.sessionId === sessionId)?.title;
      if (title && title !== 'Untitled conversation') setTitle(panel.id, title);
    });
  }, [panel.id, state.phase, state.sessionId, aiTitle]);

  useEffect(() => {
    if (state.sessionId) panel.updateParameters({ ...panel.getParameters(), sessionId: state.sessionId });
  }, [panel, state.sessionId]);
}

function ChatTab({ panel, sessionId, mode }: { panel: DockviewPanelApi; sessionId: string | null; mode: PermissionMode }) {
  const chat = useChatSession(sessionId, mode);
  useChatSync(panel, chat);
  return <ChatView chat={chat} />;
}

function TerminalOverlay({ status, onRestart }: { status: ClaudeStatus; onRestart: () => void }) {
  if (status.kind === 'running') return null;
  if (status.kind === 'starting') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="spinner" aria-label="Starting Claude" />
      </div>
    );
  }
  const message = status.kind === 'exited' ? `Claude stopped (exit code ${status.exitCode}).` : status.message;
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--color-terminal-text)' }}>
      <span className="flex-1">{message}</span>
      <button className="button-primary" onClick={onRestart}>
        {status.kind === 'failed' && status.notInstalled ? 'Try Again' : 'Restart Claude'}
      </button>
    </div>
  );
}

interface TerminalTabProps {
  panelId: string;
  sessionId: string | null;
  restartRef: { current: () => void };
}

function TerminalTab({ panelId, sessionId, restartRef }: TerminalTabProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { status, restart } = useClaudeTerminal(hostRef, panelId, sessionId);
  useLayoutEffect(() => {
    restartRef.current = () => void restart();
  });
  return (
    <div className="relative mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden pt-1" style={{ background: 'var(--color-terminal-background)', borderRadius: 'var(--radius-inner)' }}>
      <div ref={hostRef} className="terminal-host min-h-0 flex-1" />
      <TerminalOverlay status={status} onRestart={() => void restart()} />
    </div>
  );
}

/** One Claude conversation: a chat by default, the raw terminal one click away (same conversation). */
export function ClaudePanel({ api, params }: IDockviewPanelProps<TabParams>) {
  const [view, setView] = useState<ViewMode>(params.view === 'terminal' ? 'terminal' : 'chat');
  const session = useClaudeSessions((state) => state.sessions[api.id]);
  const restartTerminal = useRef<() => void>(() => undefined);
  const sessionId = isSessionId(params.sessionId) ? params.sessionId : null;
  const mode = (PERMISSION_MODES as string[]).includes(params.permissionMode ?? '') ? (params.permissionMode as PermissionMode) : DEFAULT_PERMISSION_MODE;

  // The tab closed (switching Chat/Terminal doesn't unmount the panel): drop it from the sidebar list.
  useEffect(() => () => useClaudeSessions.getState().remove(api.id), [api.id]);

  const switchView = (next: ViewMode) => {
    setView(next);
    api.updateParameters({ ...api.getParameters(), view: next });
  };

  return (
    <div className="flex h-full flex-col bg-(--color-card)">
      <div className="flex h-12 shrink-0 items-center gap-3 pr-2 pl-4">
        <ClaudeLogo size={22} busy={session?.busy === true} dim={session?.status !== 'running'} />
        <span className="title min-w-0 truncate">{session?.title ?? 'Claude'}</span>
        <StatusPill session={session} />
        <span className="flex-1" />
        <ModeSwitch mode={view} onChange={switchView} />
        {view === 'terminal' && <AppearanceButton />}
        {view === 'terminal' && (
          <button className="icon-button" title="Restart Claude" aria-label="Restart Claude" onClick={() => restartTerminal.current()}>
            <RotateCw size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {view === 'chat' ? (
        <ChatTab key="chat" panel={api} sessionId={sessionId} mode={mode} />
      ) : (
        <TerminalTab key="terminal" panelId={api.id} sessionId={sessionId} restartRef={restartTerminal} />
      )}
    </div>
  );
}
