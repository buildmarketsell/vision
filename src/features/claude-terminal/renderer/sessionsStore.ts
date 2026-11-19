import { create } from 'zustand';
import { focusPanel, getDockApi, openOwnGroupPanel } from '../../../renderer/core/dockActions';

export const CLAUDE_TAB = 'claude-terminal';
export const DEFAULT_TITLE = 'Claude';

export type SessionStatus = 'starting' | 'running' | 'stopped' | 'failed';

export interface ClaudeSession {
  id: string;
  title: string;
  status: SessionStatus;
  /** True while Claude is printing output (thinking, running tools). */
  busy: boolean;
  /** True while a permission request or question waits for you. */
  waiting: boolean;
}

interface SessionsState {
  sessions: Record<string, ClaudeSession>;
  /** Panel ids in the order the sessions were opened. */
  order: string[];
  lastActiveId: string | null;
  update: (id: string, change: Partial<Omit<ClaudeSession, 'id'>>) => void;
  remove: (id: string) => void;
  setLastActive: (id: string) => void;
}

export const useClaudeSessions = create<SessionsState>((set) => ({
  sessions: {},
  order: [],
  lastActiveId: null,
  update: (id, change) =>
    set((state) => {
      const current = state.sessions[id] ?? { id, title: DEFAULT_TITLE, status: 'starting', busy: false, waiting: false };
      const next = { ...current, ...change };
      const unchanged = state.sessions[id] && (Object.keys(change) as Array<keyof typeof change>).every((key) => current[key] === next[key]);
      if (unchanged) return state;
      const order = state.order.includes(id) ? state.order : [...state.order, id];
      return { sessions: { ...state.sessions, [id]: next }, order };
    }),
  remove: (id) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[id];
      return {
        sessions,
        order: state.order.filter((item) => item !== id),
        lastActiveId: state.lastActiveId === id ? null : state.lastActiveId,
      };
    }),
  setLastActive: (id) => set({ lastActiveId: id }),
}));

/**
 * Claude Code names the terminal after the conversation (e.g. "✳ Workspace app plan").
 * Drop the leading status symbol; keep "Claude" until it has a real name.
 */
export function cleanTitle(raw: string): string {
  const title = raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (title === '' || /^claude( code)?$/i.test(title)) return DEFAULT_TITLE;
  return title;
}

let counter = 0;

/** Opens a new Claude tab; with a session id it continues that saved conversation. */
export function newClaudeSession(sessionId?: string, title = DEFAULT_TITLE): void {
  counter += 1;
  const id = `claude:${Date.now().toString(36)}-${counter}`;
  openOwnGroupPanel(CLAUDE_TAB, id, title, sessionId ? { sessionId } : {});
}

/** The tab showing this saved conversation, if one is open. */
export function panelForConversation(sessionId: string): string | null {
  const panel = getDockApi()?.panels.find(
    (item) => item.view.contentComponent === CLAUDE_TAB && (item.params as { sessionId?: unknown } | undefined)?.sessionId === sessionId,
  );
  return panel?.id ?? null;
}

/** Jumps to the Claude session used last, or starts one when none is open. */
export function focusOrStartClaude(): string | null {
  const { lastActiveId, order } = useClaudeSessions.getState();
  const api = getDockApi();
  const target = [lastActiveId, ...[...order].reverse()].find((id) => id && api?.getPanel(id));
  if (target) {
    focusPanel(target);
    return target;
  }
  newClaudeSession();
  return null;
}
