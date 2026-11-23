import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  isImageMediaType,
  isModelName,
  isEffortLevel,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_TITLE_SOURCE_CHARS,
  MCP_STATUS_REQUEST_ID,
  PERMISSION_MODES,
  TITLE_REQUEST_ID,
  type ChatOutgoing,
  type EffortLevel,
  type PermissionMode,
} from '../../shared/claudeChat';
import { logError } from '../log';
import { locateClaude, NOT_FOUND_MESSAGE } from './claudeExecutable';

/**
 * One `claude -p` stream-json process: the chat tabs and the agents both run Claude through this.
 * Lines on stdout become events, messages from VISION are checked by `toClaudeMessage` before they reach Claude.
 */

const MAX_MESSAGE_CHARS = 200_000;
const ERROR_TAIL_CHARS = 4000;
const MAX_SYSTEM_PROMPT_CHARS = 20_000;

export interface ClaudeRunOptions {
  folder: string;
  mode: PermissionMode;
  model: string | null;
  effort: EffortLevel;
  /** Continue this saved conversation. */
  resumeId?: string | null;
  /** Start a new conversation under this id (agents pick their own, so they can find it again). */
  newSessionId?: string | null;
  /** Added to Claude Code's own system prompt (an agent's job). */
  appendSystemPrompt?: string | null;
  /** Skip every permission check (an agent trusted to never ask). */
  skipPermissions?: boolean;
  onEvent: (event: unknown) => void;
  onExit: (exitCode: number | null, errorTail: string) => void;
}

export interface ClaudeRun {
  /** Writes one stream-json message to Claude. */
  write: (message: object) => void;
  stop: () => void;
}

export type ClaudeStart = { ok: true; run: ClaudeRun } | { ok: false; reason: 'not-found' | 'spawn-failed'; message: string };

export function claudeArgs(options: Omit<ClaudeRunOptions, 'folder' | 'onEvent' | 'onExit'>): string[] {
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    // Permission requests and questions come to VISION as control requests.
    '--permission-prompt-tool', 'stdio',
    '--permission-mode', options.mode,
    '--effort', options.effort,
  ];
  if (options.resumeId) args.push('--resume', options.resumeId);
  else if (options.newSessionId) args.push('--session-id', options.newSessionId);
  if (options.model && options.model !== 'default') args.push('--model', options.model);
  if (options.appendSystemPrompt) args.push('--append-system-prompt', options.appendSystemPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS));
  if (options.skipPermissions) args.push('--dangerously-skip-permissions');
  return args;
}

function forwardLines(child: ChildProcessWithoutNullStreams, onEvent: (event: unknown) => void): void {
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        // Only the parse is guarded: an error inside onEvent must not send the same line a second time.
        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          event = { type: 'vision_unparsed', text: line.slice(0, 2000) };
        }
        onEvent(event);
      }
      newline = buffer.indexOf('\n');
    }
  });
}

export async function startClaude(options: ClaudeRunOptions): Promise<ClaudeStart> {
  const claude = await locateClaude();
  if (!claude) return { ok: false, reason: 'not-found', message: NOT_FOUND_MESSAGE };
  try {
    const child = spawn(claude.executable, claudeArgs(options), { cwd: options.folder, env: claude.env });
    let errorTail = '';
    forwardLines(child, options.onEvent);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      errorTail = (errorTail + chunk).slice(-ERROR_TAIL_CHARS);
    });
    child.on('error', (error) => logError('Claude process error', error));
    child.on('exit', (exitCode) => options.onExit(exitCode, errorTail));
    const run: ClaudeRun = {
      write: (message) => {
        if (!child.stdin.destroyed) child.stdin.write(`${JSON.stringify(message)}\n`);
      },
      stop: () => {
        child.stdin.end();
        child.kill();
      },
    };
    run.write({ type: 'control_request', request_id: 'vision-init', request: { subtype: 'initialize' } });
    return { ok: true, run };
  } catch (error) {
    logError('Could not start Claude', error);
    return { ok: false, reason: 'spawn-failed', message: error instanceof Error ? error.message : 'Claude did not start.' };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

export function isPermissionMode(value: unknown): value is PermissionMode {
  return typeof value === 'string' && (PERMISSION_MODES as string[]).includes(value);
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Image content blocks for Claude, or null if any image is invalid or too big. */
export function toImageBlocks(images: unknown): object[] | null {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > MAX_IMAGES_PER_MESSAGE) return null;
  const blocks: object[] = [];
  for (const image of images) {
    if (!isPlainObject(image) || !isImageMediaType(image['mediaType'])) return null;
    const data = image['data'];
    if (typeof data !== 'string' || (data.length * 3) / 4 > MAX_IMAGE_BYTES || !BASE64_PATTERN.test(data)) return null;
    blocks.push({ type: 'image', source: { type: 'base64', media_type: image['mediaType'], data } });
  }
  return blocks;
}

function userMessage(text: unknown, images: unknown): object | null {
  if (!isShortText(text, MAX_MESSAGE_CHARS)) return null;
  const imageBlocks = toImageBlocks(images);
  if (!imageBlocks || (text.trim() === '' && imageBlocks.length === 0)) return null;
  const content = imageBlocks.length === 0 ? text : [...imageBlocks, ...(text.trim() ? [{ type: 'text', text }] : [])];
  return { type: 'user', message: { role: 'user', content } };
}

let nextRequest = 1;

function controlResponse(requestId: string, response: object): object {
  return { type: 'control_response', response: { subtype: 'success', request_id: requestId, response } };
}

function controlRequest(request: object): object {
  return { type: 'control_request', request_id: `vision-${nextRequest++}`, request };
}

/** Claude writes a short title and saves it with the conversation (`persist`), so the saved list shows it too. */
function generateTitle(text: unknown): object | null {
  if (!isShortText(text, MAX_MESSAGE_CHARS) || text.trim() === '') return null;
  const request = { subtype: 'generate_session_title', description: text.slice(0, MAX_TITLE_SOURCE_CHARS), persist: true };
  return { type: 'control_request', request_id: TITLE_REQUEST_ID, request };
}

/** Turns a validated window message into the stream-json line Claude expects; null if invalid. */
export function toClaudeMessage(outgoing: unknown): object | null {
  if (!isPlainObject(outgoing)) return null;
  const message = outgoing as Partial<ChatOutgoing> & Record<string, unknown>;
  switch (message.kind) {
    case 'message':
      return userMessage(message['text'], message['images']);
    case 'allow':
      if (!isShortText(message['requestId'], 200) || !isPlainObject(message['updatedInput'])) return null;
      return controlResponse(message['requestId'], { behavior: 'allow', updatedInput: message['updatedInput'] });
    case 'deny':
      if (!isShortText(message['requestId'], 200) || !isShortText(message['message'], 2000)) return null;
      return controlResponse(message['requestId'], { behavior: 'deny', message: message['message'] });
    case 'interrupt':
      return controlRequest({ subtype: 'interrupt' });
    case 'setPermissionMode':
      return isPermissionMode(message['mode']) ? controlRequest({ subtype: 'set_permission_mode', mode: message['mode'] }) : null;
    case 'setModel':
      return isModelName(message['model']) ? controlRequest({ subtype: 'set_model', model: message['model'] }) : null;
    case 'setEffort':
      return isEffortLevel(message['effort']) ? controlRequest({ subtype: 'apply_flag_settings', settings: { effortLevel: message['effort'] } }) : null;
    case 'generateTitle':
      return generateTitle(message['text']);
    case 'mcpStatus':
      return { type: 'control_request', request_id: MCP_STATUS_REQUEST_ID, request: { subtype: 'mcp_status' } };
    default:
      return null;
  }
}
