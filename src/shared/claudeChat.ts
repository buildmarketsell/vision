/** Types for the Claude chat: VISION runs `claude -p` with stream-json in and out. */

export type PermissionMode = 'auto' | 'acceptEdits' | 'default' | 'plan';

export const PERMISSION_MODES: PermissionMode[] = ['auto', 'acceptEdits', 'default', 'plan'];

/**
 * New chats never stop to ask (Dan's choice, 2026-11-17): in auto mode Claude approves safe actions itself
 * and refuses risky ones. "Edit automatically" still asked before commands. The picker offers the others.
 */
export const DEFAULT_PERMISSION_MODE: PermissionMode = 'auto';

/** New chats run Opus 5.5 on medium effort (Dan's choice, 2026-11-17); the model picker can still switch. */
export const DEFAULT_MODEL = 'opus';
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export const DEFAULT_EFFORT: EffortLevel = 'medium';

/** Claude accepts any effort string without complaint, so VISION checks it before it reaches the CLI. */
export function isEffortLevel(value: unknown): value is EffortLevel {
  return (EFFORT_LEVELS as readonly unknown[]).includes(value);
}

/** Fixed id for the MCP status request, so the window can pick out its reply. */
export const MCP_STATUS_REQUEST_ID = 'vision-mcp-status';

export interface ChatStartOptions {
  /** Continue an earlier conversation. */
  resumeSessionId?: string;
  permissionMode: PermissionMode;
  /** A model alias or id from Claude's own list (e.g. "sonnet", "opus[1m]"). */
  model?: string;
  effort?: EffortLevel;
}

/** Model names reach a command line: letters, digits and a few separators only. */
export const MODEL_PATTERN = /^[a-zA-Z0-9.\-[\]]{1,64}$/;

export function isModelName(value: unknown): value is string {
  return typeof value === 'string' && MODEL_PATTERN.test(value);
}

export type ChatStartResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not-found' | 'no-folder' | 'spawn-failed'; message: string };

/** Image types Claude accepts, and its per-image size limit. */
export const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 10;

export function isImageMediaType(value: unknown): value is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly unknown[]).includes(value);
}

/** A pasted or dropped image, base64 without the data: prefix. */
export interface ChatImage {
  mediaType: ImageMediaType;
  data: string;
}

/** What the window may send to Claude (validated in main). */
export type ChatOutgoing =
  | { kind: 'message'; text: string; images?: ChatImage[] }
  | { kind: 'allow'; requestId: string; updatedInput: Record<string, unknown> }
  | { kind: 'deny'; requestId: string; message: string }
  | { kind: 'interrupt' }
  | { kind: 'setPermissionMode'; mode: PermissionMode }
  | { kind: 'setModel'; model: string }
  | { kind: 'setEffort'; effort: EffortLevel }
  | { kind: 'mcpStatus' };

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
