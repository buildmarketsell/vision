import { ipcMain, type WebContents } from 'electron';
import { IPC } from '../../../shared/ipc';
import {
  DEFAULT_EFFORT,
  DEFAULT_PERMISSION_MODE,
  isEffortLevel,
  isModelName,
  isSessionId,
  type ChatStartResult,
} from '../../../shared/claudeChat';
import { onWindowClosed, windowContextFor } from '../../../main/windows';
import { isPermissionMode, startClaude, toClaudeMessage, type ClaudeRun } from '../../../main/claude/claudeProcess';

export { toClaudeMessage };

interface ChatSession {
  run: ClaudeRun;
  owner: WebContents;
}

const sessions = new Map<number, ChatSession>();
let nextId = 1;

async function startChat(owner: WebContents, options: unknown): Promise<ChatStartResult> {
  const folder = windowContextFor(owner)?.folder;
  if (!folder) return { ok: false, reason: 'no-folder', message: 'Open a folder first.' };
  const record = (options ?? {}) as Record<string, unknown>;
  const id = nextId++;
  const send = (channel: string, payload: object) => {
    if (!owner.isDestroyed()) owner.send(channel, payload);
  };
  const started = await startClaude({
    folder,
    mode: isPermissionMode(record['permissionMode']) ? record['permissionMode'] : DEFAULT_PERMISSION_MODE,
    resumeId: isSessionId(record['resumeSessionId']) ? record['resumeSessionId'] : null,
    model: isModelName(record['model']) ? record['model'] : null,
    effort: isEffortLevel(record['effort']) ? record['effort'] : DEFAULT_EFFORT,
    onEvent: (event) => send(IPC.chatEvent, { id, event }),
    onExit: (exitCode, errorTail) => {
      sessions.delete(id);
      send(IPC.chatExit, { id, exitCode, errorTail });
    },
  });
  if (!started.ok) return started;
  sessions.set(id, { run: started.run, owner });
  return { ok: true, id };
}

function ownedSession(sender: WebContents, id: unknown): ChatSession | undefined {
  const session = typeof id === 'number' ? sessions.get(id) : undefined;
  return session && session.owner === sender ? session : undefined;
}

function stopSession(id: number, session: ChatSession): void {
  sessions.delete(id);
  session.run.stop();
}

/** Main-process side of the Claude chat: one `claude -p` stream-json process per chat tab. */
export function registerClaudeChat(): void {
  ipcMain.handle(IPC.chatStart, (event, options: unknown) => startChat(event.sender, options));
  ipcMain.on(IPC.chatSend, (event, id: unknown, outgoing: unknown) => {
    const session = ownedSession(event.sender, id);
    const message = toClaudeMessage(outgoing);
    if (session && message) session.run.write(message);
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
