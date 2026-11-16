import { isAbsolute, relative, resolve } from 'node:path';

/** True when `target` is `folder` itself or somewhere inside it. */
export function isInsideFolder(folder: string, target: string): boolean {
  if (!isAbsolute(target)) return false;
  const fromFolder = relative(resolve(folder), resolve(target));
  return fromFolder === '' || (!fromFolder.startsWith('..') && !isAbsolute(fromFolder));
}

/** Returns an error message for a bad file or folder name, or null when it is fine. */
export function validateEntryName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'The name is empty.';
  if (trimmed === '.' || trimmed === '..') return 'That name is reserved.';
  if (trimmed.includes('/') || trimmed.includes('\0')) return 'Names cannot contain "/".';
  if (trimmed.length > 255) return 'The name is too long.';
  return null;
}

export const SHELL_PATH_MARKER = '__VISION_PATH__';

/** Pulls the PATH printed between two markers out of noisy login-shell output. */
export function parseShellPath(output: string): string | null {
  const start = output.indexOf(SHELL_PATH_MARKER);
  if (start === -1) return null;
  const end = output.indexOf(SHELL_PATH_MARKER, start + SHELL_PATH_MARKER.length);
  if (end === -1) return null;
  const value = output.slice(start + SHELL_PATH_MARKER.length, end).trim();
  return value === '' ? null : value;
}

/** True when the first bytes of a file contain a NUL byte, which text files never do. */
export function looksBinary(sample: Uint8Array): boolean {
  return sample.includes(0);
}
