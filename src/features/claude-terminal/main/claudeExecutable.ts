import { accessSync, constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { childProcessEnv } from '../../../main/shellEnv';

/** The `claude` CLI. Tests point it at a fake script. */
const CLAUDE_COMMAND = process.env['VISION_CLAUDE_COMMAND'] ?? 'claude';

export const NOT_FOUND_MESSAGE = "Claude Code isn't installed. Install it, then run `claude` once in Terminal to sign in.";

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds a command's full path using the login-shell PATH. */
function findExecutable(command: string, pathValue: string): string | null {
  if (isAbsolute(command)) return isExecutable(command) ? command : null;
  for (const dir of pathValue.split(':')) {
    const candidate = join(dir, command);
    if (dir && isExecutable(candidate)) return candidate;
  }
  return null;
}

/** The `claude` path and the environment to run it with, or null when it isn't installed. */
export async function locateClaude(): Promise<{ executable: string; env: Record<string, string> } | null> {
  const env = await childProcessEnv();
  const executable = findExecutable(CLAUDE_COMMAND, env['PATH'] ?? '');
  return executable ? { executable, env } : null;
}
