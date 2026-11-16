import { app } from 'electron';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Writes errors to ~/Library/Logs/VISION/main.log. Never pass file contents or secrets here. */
export function logError(message: string, error?: unknown): void {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error ?? '');
  const line = `[${new Date().toISOString()}] ${message} ${detail}\n`;
  console.error(line);
  const logDir = app.getPath('logs');
  void mkdir(logDir, { recursive: true })
    .then(() => appendFile(join(logDir, 'main.log'), line))
    .catch(() => undefined);
}
