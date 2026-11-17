import type { ChatItem, ChatState, LocalAction, ToolCall } from './chatTypes';
import { asArr, asObj, asStr, describeTool, parseQuestions, parseTodos, toolResultText, type Obj } from './eventParsing';
import { reduceSessionInfo } from './sessionInfo';

/**
 * Turns Claude's stream-json events (and the window's own actions) into chat state.
 * Pure and defensive: unknown events are counted, never thrown on.
 */

/** Omit that keeps the union: each kind of item without its key. */
type NewItem = ChatItem extends infer Item ? (Item extends ChatItem ? Omit<Item, 'key'> : never) : never;

const INTERRUPTED_PREFIX = '[Request interrupted';
const IGNORED_TYPES = new Set(['rate_limit_event', 'control_response']);

function withItem(state: ChatState, item: NewItem): ChatState {
  const key = `item-${state.nextKey}`;
  return { ...state, items: [...state.items, { ...item, key } as ChatItem], nextKey: state.nextKey + 1 };
}

function updateItem(state: ChatState, key: string, change: Partial<Extract<ChatItem, { kind: 'text' }>>): ChatState {
  return { ...state, items: state.items.map((item) => (item.key === key && item.kind === 'text' ? { ...item, ...change } : item)) };
}

function setTool(state: ChatState, tool: ToolCall): ChatState {
  return { ...state, tools: { ...state.tools, [tool.id]: tool } };
}

function reduceSystem(state: ChatState, event: Obj): ChatState {
  switch (event['subtype']) {
    case 'init':
      return { ...state, sessionId: asStr(event['session_id']) ?? state.sessionId, model: asStr(event['model']) ?? state.model };
    case 'status':
      return event['status'] === 'requesting' ? { ...state, phase: 'working', activity: 'Thinking…' } : state;
    case 'thinking_tokens':
      return { ...state, activity: 'Thinking…' };
    case 'permission_denied':
      return withItem(state, { kind: 'notice', text: asStr(event['message']) ?? 'Permission denied.', tone: 'warning' });
    default:
      return state;
  }
}

/** Partial output: text appears word by word as Claude writes it. */
function reduceStream(state: ChatState, event: Obj): ChatState {
  const inner = asObj(event['event']);
  const messageId = asStr(event['api_message_id']) ?? '';
  const index = typeof inner?.['index'] === 'number' ? inner['index'] : -1;
  const streamKey = `${messageId}:${index}`;
  if (inner?.['type'] === 'content_block_start') {
    const block = asObj(inner['content_block']);
    if (block?.['type'] === 'text') {
      const next = withItem(state, { kind: 'text', text: '', streaming: true });
      const key = next.items[next.items.length - 1]?.key ?? '';
      return { ...next, phase: 'working', activity: 'Writing…', streamingKeys: { ...next.streamingKeys, [streamKey]: key } };
    }
    if (block?.['type'] === 'tool_use') return { ...state, activity: `Using ${asStr(block['name']) ?? 'a tool'}…` };
    return state;
  }
  if (inner?.['type'] === 'content_block_delta') {
    const delta = asObj(inner['delta']);
    const key = state.streamingKeys[streamKey];
    const text = asStr(delta?.['text']);
    if (!key || delta?.['type'] !== 'text_delta' || text === null) return state;
    const item = state.items.find((candidate) => candidate.key === key);
    const current = item?.kind === 'text' ? item.text : '';
    return updateItem(state, key, { text: current + text });
  }
  return state;
}

function reduceToolUse(state: ChatState, block: Obj, fromHistory: boolean): ChatState {
  const id = asStr(block['id']);
  const name = asStr(block['name']) ?? 'Tool';
  if (!id) return state;
  const input = asObj(block['input']) ?? {};
  const existing = state.tools[id];
  let next = setTool(state, { id, name, input, status: existing?.status ?? (fromHistory ? 'done' : 'running'), result: existing?.result ?? null });
  if (!existing) next = withItem(next, { kind: 'tool', toolId: id });
  const todos = parseTodos(input);
  if (todos) next = { ...next, todos };
  return fromHistory ? next : { ...next, activity: describeTool(name, input) };
}

/** A finished assistant message: final text replaces the streamed text; tool calls become rows. */
function reduceAssistant(state: ChatState, event: Obj): ChatState {
  const message = asObj(event['message']);
  const messageId = asStr(message?.['id']) ?? '';
  const fromHistory = event['history'] === true;
  let next = state;
  for (const raw of asArr(message?.['content'])) {
    const block = asObj(raw);
    if (!block) continue;
    if (block['type'] === 'text') {
      const text = asStr(block['text']) ?? '';
      const streamKey = Object.keys(next.streamingKeys).find((key) => key.startsWith(`${messageId}:`));
      const itemKey = streamKey ? next.streamingKeys[streamKey] : undefined;
      if (streamKey && itemKey) {
        const remaining = { ...next.streamingKeys };
        delete remaining[streamKey];
        next = { ...updateItem(next, itemKey, { text, streaming: false }), streamingKeys: remaining };
      } else if (text.trim()) {
        next = withItem(next, { kind: 'text', text, streaming: false });
      }
    } else if (block['type'] === 'tool_use') {
      next = reduceToolUse(next, block, fromHistory);
    }
  }
  return next;
}

/** User events carry tool results, the "interrupted" marker, and (in history) your messages. */
function reduceUser(state: ChatState, event: Obj): ChatState {
  const content = asObj(event['message'])?.['content'];
  if (typeof content === 'string') return content.trim() ? withItem(state, { kind: 'user', text: content }) : state;
  let next = state;
  for (const raw of asArr(content)) {
    const block = asObj(raw);
    if (!block) continue;
    if (block['type'] === 'tool_result') {
      const tool = next.tools[asStr(block['tool_use_id']) ?? ''];
      if (!tool) continue;
      const status = block['is_error'] === true ? (tool.status === 'denied' ? 'denied' : 'error') : 'done';
      next = setTool(next, { ...tool, status, result: toolResultText(block['content']) });
    } else if (block['type'] === 'text') {
      const text = asStr(block['text']) ?? '';
      if (text.startsWith(INTERRUPTED_PREFIX)) next = withItem(next, { kind: 'notice', text: 'Stopped.', tone: 'info' });
      else if (event['history'] === true && text.trim() && !text.startsWith('<')) next = withItem(next, { kind: 'user', text });
    }
  }
  return next;
}

function reduceControlRequest(state: ChatState, event: Obj): ChatState {
  const requestId = asStr(event['request_id']);
  const request = asObj(event['request']);
  if (!requestId || request?.['subtype'] !== 'can_use_tool') return state;
  const toolName = asStr(request['tool_name']) ?? 'Tool';
  const input = asObj(request['input']) ?? {};
  const waiting = { ...state, activity: 'Waiting for you' };
  if (toolName === 'AskUserQuestion') {
    return { ...waiting, questions: [...state.questions, { requestId, input, questions: parseQuestions(input) }] };
  }
  const permission = { requestId, toolName, input, toolUseId: asStr(request['tool_use_id']), description: asStr(request['description']) };
  return { ...waiting, permissions: [...state.permissions, permission] };
}

/** End of a turn: stop spinners, total the cost, surface errors. */
function reduceResult(state: ChatState, event: Obj): ChatState {
  const cost = typeof event['total_cost_usd'] === 'number' ? event['total_cost_usd'] : 0;
  const tools = Object.fromEntries(
    Object.entries(state.tools).map(([id, tool]) => [id, tool.status === 'running' ? { ...tool, status: 'stopped' as const } : tool]),
  );
  const items = state.items.map((item) => (item.kind === 'text' && item.streaming ? { ...item, streaming: false } : item));
  let next: ChatState = { ...state, items, tools, phase: 'idle', activity: '', costUsd: state.costUsd + cost, streamingKeys: {}, permissions: [], questions: [] };
  if (event['is_error'] === true) {
    const text = asStr(event['result']) ?? 'Claude stopped with an error.';
    next = withItem(next, { kind: 'notice', text, tone: 'error' });
  }
  return next;
}

export function reduceClaudeEvent(previous: ChatState, raw: unknown): ChatState {
  const event = asObj(raw);
  const type = asStr(event?.['type']);
  if (!event || !type) return { ...previous, unknownEvents: previous.unknownEvents + 1 };
  const info = reduceSessionInfo(previous.info, event);
  const state = info === previous.info ? previous : { ...previous, info };
  switch (type) {
    case 'system':
      return reduceSystem(state, event);
    case 'stream_event':
      return reduceStream(state, event);
    case 'assistant':
      return reduceAssistant(state, event);
    case 'user':
      return reduceUser(state, event);
    case 'control_request':
      return reduceControlRequest(state, event);
    case 'result':
      return reduceResult(state, event);
    default:
      return IGNORED_TYPES.has(type) ? state : { ...state, unknownEvents: state.unknownEvents + 1 };
  }
}

export function reduceLocal(state: ChatState, action: LocalAction): ChatState {
  switch (action.type) {
    case 'local/sent':
      return { ...withItem(state, { kind: 'user', text: action.text, ...(action.images?.length ? { images: action.images } : {}) }), phase: 'working', activity: 'Thinking…' };
    case 'local/resolved': {
      const permission = state.permissions.find((item) => item.requestId === action.requestId);
      let next: ChatState = {
        ...state,
        permissions: state.permissions.filter((item) => item.requestId !== action.requestId),
        questions: state.questions.filter((item) => item.requestId !== action.requestId),
        activity: action.denied ? '' : 'Working…',
      };
      const tool = permission?.toolUseId ? next.tools[permission.toolUseId] : undefined;
      if (tool && action.denied) next = setTool(next, { ...tool, status: 'denied' });
      return next;
    }
    case 'local/started':
      return { ...state, phase: 'idle' };
    case 'local/exited':
      return withItem(
        { ...state, phase: 'stopped', permissions: [], questions: [], activity: '' },
        { kind: 'notice', text: action.exitCode === 0 ? 'Claude stopped.' : `Claude stopped unexpectedly. ${action.errorTail.trim().split('\n').slice(-3).join(' ')}`.trim(), tone: action.exitCode === 0 ? 'info' : 'error' },
      );
    case 'local/failed':
      return withItem({ ...state, phase: 'stopped' }, { kind: 'notice', text: action.message, tone: 'error' });
    case 'local/reset':
      return { ...state, items: [], tools: {}, todos: [], permissions: [], questions: [], streamingKeys: {} };
  }
}
