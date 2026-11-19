import { shell } from 'electron';
import { constants } from 'node:fs';
import { copyFile, open, readdir, readFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { BINARY_SNIFF_BYTES, MAX_EDITABLE_FILE_BYTES } from '../../shared/app';
import { IMAGES_FOLDER, pastedImageName, VIDEOS_FOLDER } from '../../shared/markdownImages';
import type { DirEntry, ReadFileResult, Result } from '../../shared/ipc';
import { looksBinary, validateEntryName } from '../paths';

/** Never shown in the file tree. */
const HIDDEN_FROM_TREE = new Set(['.git', '.DS_Store']);

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code === 'ENOENT') return 'It no longer exists.';
    if (code === 'EACCES' || code === 'EPERM') return 'macOS denied access to it.';
    if (code === 'EEXIST') return 'Something with that name already exists.';
  }
  return error instanceof Error ? error.message : 'Unknown error.';
}

function fail<T>(error: unknown): Result<T> {
  return { ok: false, error: errorText(error) };
}

async function isDirectoryEntry(path: string, isDir: boolean, isSymlink: boolean): Promise<boolean> {
  if (isDir) return true;
  if (!isSymlink) return false;
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function sortEntries(entries: DirEntry[]): DirEntry[] {
  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export async function listDirectory(path: string): Promise<Result<DirEntry[]>> {
  try {
    const dirents = await readdir(path, { withFileTypes: true });
    const visible = dirents.filter((dirent) => !HIDDEN_FROM_TREE.has(dirent.name));
    const entries = await Promise.all(
      visible.map(async (dirent) => {
        const entryPath = join(path, dirent.name);
        return {
          name: dirent.name,
          path: entryPath,
          isDirectory: await isDirectoryEntry(entryPath, dirent.isDirectory(), dirent.isSymbolicLink()),
          isHidden: dirent.name.startsWith('.'),
        };
      }),
    );
    return { ok: true, value: sortEntries(entries) };
  } catch (error) {
    return fail(error);
  }
}

async function readSample(path: string): Promise<Uint8Array> {
  const handle = await open(path, 'r');
  try {
    const buffer = new Uint8Array(BINARY_SNIFF_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, BINARY_SNIFF_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function readTextFile(path: string): Promise<ReadFileResult> {
  try {
    const info = await stat(path);
    if (info.isDirectory()) return { kind: 'error', message: 'This is a folder.' };
    if (info.size > MAX_EDITABLE_FILE_BYTES) return { kind: 'tooLarge', sizeBytes: info.size };
    if (looksBinary(await readSample(path))) return { kind: 'binary' };
    return { kind: 'text', content: await readFile(path, 'utf8') };
  } catch (error) {
    return { kind: 'error', message: errorText(error) };
  }
}

export async function writeTextFile(path: string, content: string): Promise<Result<void>> {
  try {
    await writeFile(path, content, 'utf8');
    return { ok: true, value: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Saves a pasted image in the `images/` folder next to the note and returns its path. Never overwrites. */
export function saveImageNextTo(notePath: string, bytes: Uint8Array, ext: string): Promise<Result<string>> {
  return saveNextTo(notePath, IMAGES_FOLDER, ext, (target) => writeFile(target, bytes, { flag: 'wx' }));
}

/** Copies a video file (or writes pasted bytes) into the `videos/` folder next to a board. Never overwrites. */
export function saveVideoNextTo(boardPath: string, source: string | Uint8Array, ext: string): Promise<Result<string>> {
  return saveNextTo(boardPath, VIDEOS_FOLDER, ext, (target) =>
    typeof source === 'string' ? copyFile(source, target, constants.COPYFILE_EXCL) : writeFile(target, source, { flag: 'wx' }),
  );
}

/** `write` must fail with EEXIST rather than overwrite; the next free name is tried then. */
async function saveNextTo(notePath: string, folderName: string, ext: string, write: (target: string) => Promise<void>): Promise<Result<string>> {
  try {
    const dir = join(dirname(notePath), folderName);
    await mkdir(dir, { recursive: true });
    const name = pastedImageName(basename(notePath), new Date(), ext);
    for (let attempt = 1; attempt < 100; attempt += 1) {
      const target = join(dir, attempt === 1 ? name : name.replace(`.${ext}`, `-${attempt}.${ext}`));
      try {
        await write(target);
        return { ok: true, value: target };
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
      }
    }
    return { ok: false, error: 'Could not find a free file name.' };
  } catch (error) {
    return fail(error);
  }
}

export async function createEntry(parentDir: string, name: string, kind: 'file' | 'dir'): Promise<Result<string>> {
  const problem = validateEntryName(name);
  if (problem) return { ok: false, error: problem };
  const target = join(parentDir, name.trim());
  try {
    if (kind === 'dir') await mkdir(target);
    else await writeFile(target, '', { flag: 'wx' });
    return { ok: true, value: target };
  } catch (error) {
    return fail(error);
  }
}

export async function renameEntry(path: string, newName: string): Promise<Result<string>> {
  const problem = validateEntryName(newName);
  if (problem) return { ok: false, error: problem };
  const target = join(dirname(path), newName.trim());
  if (target === path) return { ok: true, value: path };
  try {
    const exists = await stat(target).then(
      () => true,
      () => false,
    );
    // A case-only rename (a.md -> A.md) points at the same file on macOS, so allow it.
    if (exists && basename(target).toLowerCase() !== basename(path).toLowerCase()) {
      return { ok: false, error: 'Something with that name already exists.' };
    }
    await rename(path, target);
    return { ok: true, value: target };
  } catch (error) {
    return fail(error);
  }
}

export async function moveToTrash(path: string): Promise<Result<void>> {
  try {
    await shell.trashItem(path);
    return { ok: true, value: undefined };
  } catch (error) {
    return fail(error);
  }
}
