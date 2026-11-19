/** Images in Markdown notes: where pasted images are saved, and how links resolve to local files. */

/** Local images are served to the page through this scheme (see src/main/workspace/imageProtocol.ts). */
export const IMAGE_SCHEME = 'vision-file';

/** Pasted or dropped images go in this folder, next to the note. */
export const IMAGES_FOLDER = 'images';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'] as const;

export function imageExtension(path: string): string | null {
  return extensionIn(path, IMAGE_EXTENSIONS);
}

/** Video files dropped or pasted on a board go in this folder, next to the board. */
export const VIDEOS_FOLDER = 'videos';

/** Pasted videos without a file on disk are sent as bytes; dropped files are copied by path, at any size. */
export const MAX_PASTED_VIDEO_BYTES = 200 * 1024 * 1024;

/** Formats Chromium plays on its own. */
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm'] as const;

export function videoExtension(path: string): string | null {
  return extensionIn(path, VIDEO_EXTENSIONS);
}

function extensionIn(path: string, extensions: readonly string[]): string | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return path.includes('.') && extensions.includes(ext) ? ext : null;
}

/** `/a/b/../c` → `/a/c`. Absolute POSIX paths only. */
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

/** The absolute file a relative image or file link points at, or null for web links, data URLs and anchors. */
export function resolveLocalPath(noteDir: string, href: string): string | null {
  if (href === '' || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return null;
  let decoded = href.split(/[?#]/)[0] ?? '';
  try {
    decoded = decodeURI(decoded);
  } catch {
    // Keep the raw link when it is not valid percent-encoding.
  }
  return normalize(decoded.startsWith('/') ? decoded : `${noteDir}/${decoded}`);
}

export function imageUrl(absolutePath: string): string {
  return `${IMAGE_SCHEME}://local${absolutePath.split('/').map(encodeURIComponent).join('/')}`;
}

/** Obsidian embeds (`![[photo.png]]`, `![[photo.png|300]]`) as standard Markdown images. */
export function convertEmbeds(text: string): string {
  return text.replace(/!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g, (_match, target: string) => `![](<${target.trim()}>)`);
}

/** The Markdown link from a note in `noteDir` to `target`. Angle brackets keep spaces and emoji working. */
export function relativeImageLink(noteDir: string, target: string): string {
  const from = noteDir.split('/').filter(Boolean);
  const to = target.split('/').filter(Boolean);
  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1;
  const path = [...from.slice(shared).map(() => '..'), ...to.slice(shared)].join('/');
  return /[\s()<>]/.test(path) ? `<${path}>` : path;
}

/** `My Note.md` pasted at 2026-11-16 23:05:09 → `my-note-20261116-230509.png`. */
export function pastedImageName(noteName: string, date: Date, ext: string): string {
  const slug = noteName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${slug}-${stamp}.${ext}`;
}
