import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { DEFAULT_EFFORT, DEFAULT_MODEL, type ChatImage, type EffortLevel, type PermissionMode } from '../../../../shared/claudeChat';
import { recordChatEvent } from '../usage/usageStore';
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
  /** Model alias from Claude's list; "default" means Claude Code's own choice. */
  model: string;
  setModel: (model: string) => void;
  effort: EffortLevel;
  setEffort: (effort: EffortLevel) => void;
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
  const [model, setModelState] = useState(DEFAULT_MODEL);
  const modelRef = useRef(model);
  modelRef.current = model;
  const [effort, setEffortState] = useState<EffortLevel>(DEFAULT_EFFORT);
  const effortRef = useRef(effort);
  effortRef.current = effort;

  useEffect(() => {
    let cancelled = false;
    const offEvent = window.vision.chat.onEvent(({ id, event }) => {
      if (id !== processId.current) return;
      recordChatEvent(event);
      dispatch({ type: 'claude', event });
    });
    const offExit = window.vision.chat.onExit(({ id, exitCode, errorTail }) => {
      if (id !== processId.current) return;
      processId.current = null;
      dispatch({ type: 'local/exited', exitCode, errorTail });
    });
    const start = async () => {
      dispatch({ type: 'replace', state: target.sessionId ? await loadHistory(target.sessionId) : emptyChatState() });
      if (cancelled) return;
      const options = { permissionMode: modeRef.current, model: modelRef.current, effort: effortRef.current, ...(target.sessionId ? { resumeSessionId: target.sessionId } : {}) };
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

  // Connection status for the bars above the composer: on start and after every turn (servers that were still connecting settle by then).
  useEffect(() => {
    if (state.phase === 'idle') sendRaw({ kind: 'mcpStatus' });
  }, [state.phase, sendRaw]);

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
    model,
    setModel: (next) => {
      setModelState(next);
      sendRaw({ kind: 'setModel', model: next });
    },
    effort,
    setEffort: (next) => {
      setEffortState(next);
      sendRaw({ kind: 'setEffort', effort: next });
    },
    open: (sessionId) => setTarget({ sessionId }),
  };
}
