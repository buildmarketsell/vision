import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ChatImage, PermissionMode } from '../../../../shared/claudeChat';
import { reduceClaudeEvent, reduceLocal } from './chatReducer';
import { emptyChatState, type ChatState, type LocalAction } from './chatTypes';

type Action = LocalAction | { type: 'claude'; event: unknown } | { type: 'replace'; state: ChatState };

function reducer(state: ChatState, action: Action): ChatState {
  if (action.type === 'claude') return reduceClaudeEvent(state, action.event);
  if (action.type === 'replace') return action.state;
  return reduceLocal(state, action);
}

/** Replays a saved conversation so a reopened tab shows its history. */
async function loadHistory(sessionId: string): Promise<ChatState> {
  const events = await window.vision.chat.history(sessionId);
  let state = emptyChatState();
  for (const event of events) state = reduceClaudeEvent(state, event);
  return { ...state, sessionId, phase: 'starting' };
}

export interface ChatSession {
  state: ChatState;
  mode: PermissionMode;
  send: (text: string, images?: ChatImage[]) => void;
  allow: (requestId: string, updatedInput: Record<string, unknown>) => void;
  deny: (requestId: string) => void;
  interrupt: () => void;
  setMode: (mode: PermissionMode) => void;
  /** Starts over in another saved conversation (or a new one with null). */
  open: (sessionId: string | null) => void;
}

/** One chat tab's link to a `claude -p` stream-json process. */
export function useChatSession(initialSessionId: string | null, initialMode: PermissionMode): ChatSession {
  const [state, dispatch] = useReducer(reducer, undefined, emptyChatState);
  const [mode, setModeState] = useState(initialMode);
  const [target, setTarget] = useState<{ sessionId: string | null }>({ sessionId: initialSessionId });
  const processId = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let cancelled = false;
    const offEvent = window.vision.chat.onEvent(({ id, event }) => {
      if (id === processId.current) dispatch({ type: 'claude', event });
    });
    const offExit = window.vision.chat.onExit(({ id, exitCode, errorTail }) => {
      if (id !== processId.current) return;
      processId.current = null;
      dispatch({ type: 'local/exited', exitCode, errorTail });
    });
    const start = async () => {
      dispatch({ type: 'replace', state: target.sessionId ? await loadHistory(target.sessionId) : emptyChatState() });
      if (cancelled) return;
      const options = { permissionMode: modeRef.current, ...(target.sessionId ? { resumeSessionId: target.sessionId } : {}) };
      const result = await window.vision.chat.start(options);
      if (cancelled) {
        if (result.ok) window.vision.chat.stop(result.id);
        return;
      }
      if (!result.ok) {
        dispatch({ type: 'local/failed', message: result.message });
        return;
      }
      processId.current = result.id;
      dispatch({ type: 'local/started' });
    };
    void start();
    return () => {
      cancelled = true;
      offEvent();
      offExit();
      if (processId.current !== null) window.vision.chat.stop(processId.current);
      processId.current = null;
    };
  }, [target]);

  const sendRaw = useCallback((message: Parameters<typeof window.vision.chat.send>[1]) => {
    if (processId.current !== null) window.vision.chat.send(processId.current, message);
  }, []);

  return {
    state,
    mode,
    send: (text, images = []) => {
      const trimmed = text.trim();
      if ((!trimmed && images.length === 0) || processId.current === null) return;
      const previews = images.map((image) => `data:${image.mediaType};base64,${image.data}`);
      dispatch({ type: 'local/sent', text: trimmed, images: previews });
      sendRaw({ kind: 'message', text: trimmed, ...(images.length > 0 ? { images } : {}) });
    },
    allow: (requestId, updatedInput) => {
      sendRaw({ kind: 'allow', requestId, updatedInput });
      dispatch({ type: 'local/resolved', requestId, denied: false });
    },
    deny: (requestId) => {
      sendRaw({ kind: 'deny', requestId, message: 'The user declined this. Ask what they would like instead.' });
      dispatch({ type: 'local/resolved', requestId, denied: true });
    },
    interrupt: () => sendRaw({ kind: 'interrupt' }),
    setMode: (next) => {
      setModeState(next);
      sendRaw({ kind: 'setPermissionMode', mode: next });
    },
    open: (sessionId) => setTarget({ sessionId }),
  };
}
