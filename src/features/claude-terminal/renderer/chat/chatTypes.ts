/** The chat's state, built from Claude's stream-json events by chatReducer.ts. */

export type ToolStatus = 'running' | 'done' | 'error' | 'denied' | 'stopped';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result: string | null;
}

export type ChatItem =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'text'; key: string; text: string; streaming: boolean }
  | { kind: 'tool'; key: string; toolId: string }
  | { kind: 'notice'; key: string; text: string; tone: 'info' | 'warning' | 'error' };

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolUseId: string | null;
  input: Record<string, unknown>;
  description: string | null;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  multiSelect: boolean;
  options: QuestionOption[];
}

export interface QuestionRequest {
  requestId: string;
  input: Record<string, unknown>;
  questions: Question[];
}

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string | null;
}

export type ChatPhase = 'starting' | 'idle' | 'working' | 'stopped';

export interface ChatState {
  items: ChatItem[];
  tools: Record<string, ToolCall>;
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  todos: Todo[];
  phase: ChatPhase;
  sessionId: string | null;
  model: string | null;
  /** What Claude is doing right now, for the live card. */
  activity: string;
  costUsd: number;
  /** Streaming text items by `${messageId}:${blockIndex}`. */
  streamingKeys: Record<string, string>;
  /** Events VISION didn't recognise (logged, never fatal). */
  unknownEvents: number;
  nextKey: number;
}

export function emptyChatState(): ChatState {
  return {
    items: [],
    tools: {},
    permissions: [],
    questions: [],
    todos: [],
    phase: 'starting',
    sessionId: null,
    model: null,
    activity: '',
    costUsd: 0,
    streamingKeys: {},
    unknownEvents: 0,
    nextKey: 1,
  };
}

/** Things the window itself does, mixed into the same state. */
export type LocalAction =
  | { type: 'local/sent'; text: string }
  | { type: 'local/resolved'; requestId: string; denied: boolean }
  | { type: 'local/started' }
  | { type: 'local/exited'; exitCode: number | null; errorTail: string }
  | { type: 'local/failed'; message: string }
  | { type: 'local/reset' };
