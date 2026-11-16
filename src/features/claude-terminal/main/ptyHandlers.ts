import { ipcMain, type WebContents } from 'electron';
import { accessSync, constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { spawn, type IPty } from 'node-pty';
import { IPC, type PtyStartResult } from '../../../shared/ipc';
import { childProcessEnv } from '../../../main/shellEnv';
import { onWindowClosed, windowContextFor } from '../../../main/windows';
import { logError } from '../../../main/log';

/** The command started in the Claude pane. Tests point it at a fake script. */
const CLAUDE_COMMAND = process.env['VISION_CLAUDE_COMMAND'] ?? 'claude';
const NOT_FOUND_MESSAGE = "Claude Code isn't installed. Install it, then run `claude` once in Terminal to sign in.";

interface Session {
  pty: IPty;
  owner: WebContents;
}

const sessions = new Map<number, Session>();
let nextId = 1;

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds the command's full path using the login-shell PATH. */
function findExecutable(command: string, pathValue: string): string | null {
  if (isAbsolute(command)) return isExecutable(command) ? command : null;
  for (const dir of pathValue.split(':')) {
    const candidate = join(dir, command);
    if (dir && isExecutable(candidate)) return candidate;
  }
  return null;
}

function clampSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(2, Math.min(1000, Math.floor(value))) : fallback;
}

async function startSession(owner: WebContents, cols: unknown, rows: unknown): Promise<PtyStartResult> {
  const folder = windowContextFor(owner)?.folder;
  if (!folder) return { ok: false, reason: 'no-folder', message: 'Open a folder first.' };
  const env = await childProcessEnv();
  const executable = findExecutable(CLAUDE_COMMAND, env['PATH'] ?? '');
  if (!executable) return { ok: false, reason: 'not-found', message: NOT_FOUND_MESSAGE };
  try {
    const pty = spawn(executable, [], {
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
  ipcMain.handle(IPC.ptyStart, (event, cols: unknown, rows: unknown) => startSession(event.sender, cols, rows));
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
