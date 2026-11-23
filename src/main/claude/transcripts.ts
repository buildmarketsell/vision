import { ipcMain } from 'electron';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { IPC } from '../../shared/ipc';
import { isSessionId, type PastConversation } from '../../shared/claudeChat';
import { windowContextFor } from '../windows';

/** Where Claude Code keeps its transcripts. Tests point it at a fixture folder. */
const PROJECTS_DIR = process.env['VISION_CLAUDE_PROJECTS_DIR'] ?? join(homedir(), '.claude', 'projects');
const MAX_LISTED = 20;
const TITLE_SCAN_BYTES = 64 * 1024;
const MAX_TRANSCRIPT_BYTES = 50 * 1024 * 1024;

/** Claude Code names a folder's transcript directory after its path, with every other character as "-". */
export function transcriptDirFor(folder: string): string {
  return join(PROJECTS_DIR, folder.replace(/[^a-zA-Z0-9]/g, '-'));
}

/** The conversation's name: Claude's own title if there is one, else the last prompt. */
export function titleFromTail(tail: string): string | null {
  let aiTitle: string | null = null;
  let lastPrompt: string | null = null;
  for (const line of tail.split('\n')) {
    if (!line.includes('"ai-title"') && !line.includes('"last-prompt"')) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (entry['type'] === 'ai-title' && typeof entry['aiTitle'] === 'string') aiTitle = entry['aiTitle'];
      if (entry['type'] === 'last-prompt' && typeof entry['lastPrompt'] === 'string') lastPrompt = entry['lastPrompt'];
    } catch {
      // A line cut by the scan window; ignore it.
    }
  }
  const title = aiTitle ?? lastPrompt;
  return title ? title.slice(0, 120) : null;
}

async function readTail(path: string, size: number): Promise<string> {
  const handle = await open(path, 'r');
  try {
    const length = Math.min(size, TITLE_SCAN_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

export async function listConversations(folder: string): Promise<PastConversation[]> {
  const dir = transcriptDirFor(folder);
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => isSessionId(name.replace(/\.jsonl$/, '')) && name.endsWith('.jsonl'));
  } catch {
    return [];
  }
  const withTimes = await Promise.all(
    names.map(async (name) => ({ name, info: await stat(join(dir, name)) })),
  );
  const recent = withTimes.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs).slice(0, MAX_LISTED);
  return Promise.all(
    recent.map(async ({ name, info }) => ({
      sessionId: name.replace(/\.jsonl$/, ''),
      title: titleFromTail(await readTail(join(dir, name), info.size)) ?? 'Untitled conversation',
      updatedAt: info.mtimeMs,
    })),
  );
}

/** The messages of a saved conversation, in the same shape as live stream events. */
export function messagesFromTranscript(text: string): unknown[] {
  const events: unknown[] = [];
  for (const line of text.split('\n')) {
    if (!line.includes('"message"')) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const type = entry['type'];
      if ((type !== 'user' && type !== 'assistant') || entry['isSidechain'] === true || entry['isMeta'] === true) continue;
      events.push({ type, message: entry['message'], history: true });
    } catch {
      // Skip lines that aren't JSON.
    }
  }
  return events;
}

export async function readConversation(folder: string, sessionId: string): Promise<unknown[]> {
  const path = join(transcriptDirFor(folder), `${sessionId}.jsonl`);
  try {
    if ((await stat(path)).size > MAX_TRANSCRIPT_BYTES) return [];
    return messagesFromTranscript(await readFile(path, 'utf8'));
  } catch {
    return [];
  }
}

/** Read-only access to Claude Code's saved conversations for the window's folder. */
export function registerTranscripts(): void {
  ipcMain.handle(IPC.chatList, (event) => {
    const folder = windowContextFor(event.sender)?.folder;
    return folder ? listConversations(folder) : [];
  });
  ipcMain.handle(IPC.chatHistory, (event, sessionId: unknown) => {
    const folder = windowContextFor(event.sender)?.folder;
    return folder && isSessionId(sessionId) ? readConversation(folder, sessionId) : [];
  });
}
