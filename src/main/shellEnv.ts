import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseShellPath, SHELL_PATH_MARKER } from './paths';

const SHELL_TIMEOUT_MS = 5000;
const FALLBACK_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local/bin')];

let resolvedPath: string | null = null;

function withFallbackDirs(path: string): string {
  const parts = path.split(':').filter(Boolean);
  for (const dir of FALLBACK_DIRS) if (!parts.includes(dir)) parts.push(dir);
  return parts.join(':');
}

function readLoginShellPath(): Promise<string | null> {
  const shell = process.env['SHELL'] ?? '/bin/zsh';
  const script = `printf '%s' "${SHELL_PATH_MARKER}$PATH${SHELL_PATH_MARKER}"`;
  return new Promise((done) => {
    execFile(shell, ['-ilc', script], { timeout: SHELL_TIMEOUT_MS }, (error, stdout) => {
      done(error ? null : parseShellPath(stdout));
    });
  });
}

/**
 * Apps opened from the Dock don't get the user's shell PATH, so `claude` would not be found.
 * Read it once from the login shell; fall back to the common install folders.
 */
export async function resolveShellPath(): Promise<string> {
  if (resolvedPath) return resolvedPath;
  const fromShell = await readLoginShellPath();
  resolvedPath = withFallbackDirs(fromShell ?? process.env['PATH'] ?? '/usr/bin:/bin:/usr/sbin:/sbin');
  return resolvedPath;
}

/** Environment for child processes: the shell PATH plus terminal and locale settings. */
export async function childProcessEnv(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  // Set when VISION itself is started from some editors; it would break Electron-based tools Claude runs.
  delete env['ELECTRON_RUN_AS_NODE'];
  env['PATH'] = await resolveShellPath();
  env['TERM'] = 'xterm-256color';
  env['COLORTERM'] = 'truecolor';
  env['LANG'] = env['LANG'] ?? 'en_US.UTF-8';
  return env;
}
