import { ipcMain, type WebContents } from 'electron';
import { spawn, type IPty } from 'node-pty';
import { IPC, type PtyStartResult } from '../../../shared/ipc';
import { isSessionId } from '../../../shared/claudeChat';
import { locateClaude, NOT_FOUND_MESSAGE } from './claudeExecutable';
import { onWindowClosed, windowContextFor } from '../../../main/windows';
import { logError } from '../../../main/log';

interface Session {
  pty: IPty;
  owner: WebContents;
}

const sessions = new Map<number, Session>();
let nextId = 1;

function clampSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(2, Math.min(1000, Math.floor(value))) : fallback;
}

/** Starts `claude` in a terminal; with a session id it continues that conversation. */
async function startSession(owner: WebContents, cols: unknown, rows: unknown, resumeId: unknown): Promise<PtyStartResult> {
  const folder = windowContextFor(owner)?.folder;
  if (!folder) return { ok: false, reason: 'no-folder', message: 'Open a folder first.' };
  const claude = await locateClaude();
  if (!claude) return { ok: false, reason: 'not-found', message: NOT_FOUND_MESSAGE };
  const { executable, env } = claude;
  const args = isSessionId(resumeId) ? ['--resume', resumeId] : [];
  try {
    const pty = spawn(executable, args, {
      name: 'xterm-256color',
      cols: clampSize(cols, 80),
      rows: clampSize(rows, 24),
      cwd: folder,
      env,
    });
    const id = nextId++;
    sessions.set(id, { pty, owner });
    pty.onData((data) => {
      if (!owner.isDestroyed()) owner.send(IPC.ptyData, { id, data });
    });
    pty.onExit(({ exitCode }) => {
      sessions.delete(id);
      if (!owner.isDestroyed()) owner.send(IPC.ptyExit, { id, exitCode });
    });
    return { ok: true, id };
  } catch (error) {
    logError('Could not start Claude', error);
    return { ok: false, reason: 'spawn-failed', message: error instanceof Error ? error.message : 'Claude did not start.' };
  }
}

function ownedSession(sender: WebContents, id: unknown): Session | undefined {
  const session = typeof id === 'number' ? sessions.get(id) : undefined;
  return session && session.owner === sender ? session : undefined;
}

function killSession(id: number, session: Session): void {
  sessions.delete(id);
  try {
    session.pty.kill();
  } catch {
    // The process already exited.
  }
}

/** Main-process side of the Claude terminal: runs `claude` in a pty for each pane. */
export function registerClaudeTerminal(): void {
  ipcMain.handle(IPC.ptyStart, (event, cols: unknown, rows: unknown, resumeId: unknown) =>
    startSession(event.sender, cols, rows, resumeId),
  );
  ipcMain.on(IPC.ptyWrite, (event, id: unknown, data: unknown) => {
    if (typeof data === 'string') ownedSession(event.sender, id)?.pty.write(data);
  });
  ipcMain.on(IPC.ptyResize, (event, id: unknown, cols: unknown, rows: unknown) => {
    ownedSession(event.sender, id)?.pty.resize(clampSize(cols, 80), clampSize(rows, 24));
  });
  ipcMain.on(IPC.ptyKill, (event, id: unknown) => {
    const session = ownedSession(event.sender, id);
    if (session) killSession(id as number, session);
  });
  onWindowClosed(({ webContents }) => {
    for (const [id, session] of sessions) if (session.owner === webContents) killSession(id, session);
  });
}

export function killAllClaudeSessions(): void {
  for (const [id, session] of sessions) killSession(id, session);
}
