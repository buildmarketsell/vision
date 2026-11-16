/** Types for the Claude chat: VISION runs `claude -p` with stream-json in and out. */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan';

export const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'plan'];

export interface ChatStartOptions {
  /** Continue an earlier conversation. */
  resumeSessionId?: string;
  permissionMode: PermissionMode;
}

export type ChatStartResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not-found' | 'no-folder' | 'spawn-failed'; message: string };

/** What the window may send to Claude (validated in main). */
export type ChatOutgoing =
  | { kind: 'message'; text: string }
  | { kind: 'allow'; requestId: string; updatedInput: Record<string, unknown> }
  | { kind: 'deny'; requestId: string; message: string }
  | { kind: 'interrupt' }
  | { kind: 'setPermissionMode'; mode: PermissionMode };

/** One parsed line of Claude's stream-json output. Parsed defensively in the window. */
export interface ChatEventMessage {
  id: number;
  event: unknown;
}

export interface ChatExitMessage {
  id: number;
  exitCode: number | null;
  /** Last lines Claude printed to stderr, shown when it stopped unexpectedly. */
  errorTail: string;
}

/** A saved conversation for this folder (from Claude Code's own transcript files). */
export interface PastConversation {
  sessionId: string;
  title: string;
  updatedAt: number;
}

/** Session ids are UUIDs; anything else is rejected before it reaches a command line or path. */
export const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}
