import { unsavedTabInside, withTabsClosed } from '../../../renderer/core/fileTabs';
import type { Result } from '../../../shared/ipc';
import { BOARD_EXTENSION, parseBoardText } from '../boardFile';
import { boardEmbed } from '../boardEmbeds';
import { copyName, nameOf } from '../boardLibrary';

/** Error text to show, or null when it worked. */
type Outcome = Promise<string | null>;

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function problem(result: Result<unknown>): string | null {
  return result.ok ? null : result.error;
}

/** "Untitled folder", then "Untitled folder 2"… in `dir`; returns the new folder's path or an error. */
export async function newFolder(dir: string): Promise<Result<string>> {
  const listing = await window.vision.fs.listDir(dir);
  const taken = new Set((listing.ok ? listing.value : []).map((entry) => entry.name.toLowerCase()));
  let name = 'Untitled folder';
  for (let number = 2; taken.has(name.toLowerCase()); number += 1) name = `Untitled folder ${number}`;
  return window.vision.fs.createDir(dir, name);
}

/** Renames a board (the `.excalidraw` ending is kept for it) or a folder. */
export async function renameItem(path: string, name: string, isBoard: boolean): Outcome {
  const clean = name.trim();
  if (!clean || clean === nameOf(path)) return null;
  const unsaved = unsavedTabInside(path);
  if (unsaved) return `Save or close "${unsaved}" first.`;
  return problem(await withTabsClosed(path, () => window.vision.fs.rename(path, isBoard ? `${clean}${BOARD_EXTENSION}` : clean)));
}

/** "Copy of X" next to the original; returns its path or an error. */
export async function duplicateBoard(path: string): Promise<Result<string>> {
  const file = await window.vision.fs.readFile(path);
  if (file.kind !== 'text') return { ok: false, error: 'The board could not be read.' };
  const listing = await window.vision.fs.listDir(dirOf(path));
  const created = await window.vision.fs.createFile(dirOf(path), copyName(path, listing.ok ? listing.value.map((entry) => entry.name) : []));
  if (!created.ok) return created;
  const written = await window.vision.fs.writeFile(created.value, file.content);
  return written.ok ? created : written;
}

/**
 * True when the board plays videos saved next to it: those links would break if it moved alone.
 * A board that can't be read (over the size limit, say) counts as having them, so it never moves blind.
 */
async function hasLocalVideos(path: string): Promise<boolean> {
  const file = await window.vision.fs.readFile(path);
  if (file.kind !== 'text') return true;
  const parsed = parseBoardText(file.content);
  if (parsed.kind === 'empty') return false;
  if (parsed.kind !== 'scene') return true;
  return parsed.scene.elements.some((element) => {
    const link = (element as { link?: unknown }).link;
    return typeof link === 'string' && boardEmbed(link).kind === 'video';
  });
}

export async function moveItem(path: string, targetDir: string, isBoard: boolean): Outcome {
  if (dirOf(path) === targetDir) return null;
  const unsaved = unsavedTabInside(path);
  if (unsaved) return `Save or close "${unsaved}" first.`;
  return withTabsClosed(path, async () => {
    // Checked after the tabs closed, so a video pasted just before is already saved in the file.
    if (isBoard && (await hasLocalVideos(path))) {
      return { ok: false, error: `"${nameOf(path)}" may play videos saved next to it. Move it in Finder together with its videos folder.` };
    }
    return window.vision.fs.move(path, targetDir);
  }).then(problem);
}

/** Asks first (macOS dialog), then moves it to the Trash, where Finder can put it back. */
export async function trashItem(path: string): Outcome {
  const label = nameOf(path);
  if (!(await window.vision.fs.confirmTrash(label))) return null;
  return problem(await withTabsClosed(path, () => window.vision.fs.trash(path)));
}
