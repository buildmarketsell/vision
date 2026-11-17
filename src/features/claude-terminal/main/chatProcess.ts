import { ipcMain, type WebContents } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { IPC } from '../../../shared/ipc';
import {
  DEFAULT_EFFORT,
  DEFAULT_PERMISSION_MODE,
  isEffortLevel,
  isImageMediaType,
  isModelName,
  isSessionId,
  MAX_IMAGE_BYTES,
  MCP_STATUS_REQUEST_ID,
  MAX_TITLE_SOURCE_CHARS,
  TITLE_REQUEST_ID,
  MAX_IMAGES_PER_MESSAGE,
  PERMISSION_MODES,
  type ChatOutgoing,
  type ChatStartResult,
  type EffortLevel,
  type PermissionMode,
} from '../../../shared/claudeChat';
import { onWindowClosed, windowContextFor } from '../../../main/windows';
import { logError } from '../../../main/log';
import { locateClaude, NOT_FOUND_MESSAGE } from './claudeExecutable';

const MAX_MESSAGE_CHARS = 200_000;
const ERROR_TAIL_CHARS = 4000;

interface ChatSession {
  child: ChildProcessWithoutNullStreams;
  owner: WebContents;
  errorTail: string;
}

const sessions = new Map<number, ChatSession>();
let nextId = 1;
let nextRequest = 1;

function isMode(value: unknown): value is PermissionMode {
  return typeof value === 'string' && (PERMISSION_MODES as string[]).includes(value);
}

function chatArgs(mode: PermissionMode, resumeId: string | null, model: string | null, effort: EffortLevel): string[] {
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    // Permission requests and questions come to VISION as control requests.
    '--permission-prompt-tool', 'stdio',
    '--permission-mode', mode,
    '--effort', effort,
  ];
  if (resumeId) args.push('--resume', resumeId);
  if (model && model !== 'default') args.push('--model', model);
  return args;
}

function write(session: ChatSession, message: object): void {
  if (!session.child.stdin.destroyed) session.child.stdin.write(`${JSON.stringify(message)}\n`);
}

/** Splits stdout into lines; each JSON line goes to the window as one event. */
function forwardOutput(id: number, session: ChatSession): void {
  let buffer = '';
  session.child.stdout.setEncoding('utf8');
  session.child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          event = { type: 'vision_unparsed', text: line.slice(0, 2000) };
        }
        if (!session.owner.isDestroyed()) session.owner.send(IPC.chatEvent, { id, event });
      }
      newline = buffer.indexOf('\n');
    }
  });
  session.child.stderr.setEncoding('utf8');
  session.child.stderr.on('data', (chunk: string) => {
    session.errorTail = (session.errorTail + chunk).slice(-ERROR_TAIL_CHARS);
  });
}

async function startChat(owner: WebContents, options: unknown): Promise<ChatStartResult> {
  const folder = windowContextFor(owner)?.folder;
  if (!folder) return { ok: false, reason: 'no-folder', message: 'Open a folder first.' };
  const claude = await locateClaude();
  if (!claude) return { ok: false, reason: 'not-found', message: NOT_FOUND_MESSAGE };
  const record = (options ?? {}) as Record<string, unknown>;
  const mode = isMode(record['permissionMode']) ? record['permissionMode'] : DEFAULT_PERMISSION_MODE;
  const resumeId = isSessionId(record['resumeSessionId']) ? record['resumeSessionId'] : null;
  const model = isModelName(record['model']) ? record['model'] : null;
  const effort = isEffortLevel(record['effort']) ? record['effort'] : DEFAULT_EFFORT;
  try {
    const child = spawn(claude.executable, chatArgs(mode, resumeId, model, effort), { cwd: folder, env: claude.env });
    const id = nextId++;
    const session: ChatSession = { child, owner, errorTail: '' };
    sessions.set(id, session);
    forwardOutput(id, session);
    child.on('error', (error) => logError('Claude chat process error', error));
    child.on('exit', (exitCode) => {
      sessions.delete(id);
      if (!owner.isDestroyed()) owner.send(IPC.chatExit, { id, exitCode, errorTail: session.errorTail });
    });
    write(session, { type: 'control_request', request_id: 'vision-init', request: { subtype: 'initialize' } });
    return { ok: true, id };
  } catch (error) {
    logError('Could not start Claude chat', error);
    return { ok: false, reason: 'spawn-failed', message: error instanceof Error ? error.message : 'Claude did not start.' };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
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
      return isMode(message['mode']) ? controlRequest({ subtype: 'set_permission_mode', mode: message['mode'] }) : null;
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

/** Claude writes a short title and saves it with the conversation (`persist`), so the saved list shows it too. */
function generateTitle(text: unknown): object | null {
  if (!isShortText(text, MAX_MESSAGE_CHARS) || text.trim() === '') return null;
  const request = { subtype: 'generate_session_title', description: text.slice(0, MAX_TITLE_SOURCE_CHARS), persist: true };
  return { type: 'control_request', request_id: TITLE_REQUEST_ID, request };
}

function controlResponse(requestId: string, response: object): object {
  return { type: 'control_response', response: { subtype: 'success', request_id: requestId, response } };
}

function controlRequest(request: object): object {
  return { type: 'control_request', request_id: `vision-${nextRequest++}`, request };
}

function ownedSession(sender: WebContents, id: unknown): ChatSession | undefined {
  const session = typeof id === 'number' ? sessions.get(id) : undefined;
  return session && session.owner === sender ? session : undefined;
}

function stopSession(id: number, session: ChatSession): void {
  sessions.delete(id);
  session.child.stdin.end();
  session.child.kill();
}

/** Main-process side of the Claude chat: one `claude -p` stream-json process per chat tab. */
export function registerClaudeChat(): void {
  ipcMain.handle(IPC.chatStart, (event, options: unknown) => startChat(event.sender, options));
  ipcMain.on(IPC.chatSend, (event, id: unknown, outgoing: unknown) => {
    const session = ownedSession(event.sender, id);
    const message = toClaudeMessage(outgoing);
    if (session && message) write(session, message);
  });
  ipcMain.on(IPC.chatStop, (event, id: unknown) => {
    const session = ownedSession(event.sender, id);
    if (session) stopSession(id as number, session);
  });
  onWindowClosed(({ webContents }) => {
    for (const [id, session] of sessions) if (session.owner === webContents) stopSession(id, session);
  });
}

export function stopAllChats(): void {
  for (const [id, session] of sessions) stopSession(id, session);
}
