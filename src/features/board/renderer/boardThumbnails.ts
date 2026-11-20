import { parseBoardText } from '../boardFile';

/** Pixels on the long side: sharp on a Retina card, small enough to make dozens quickly. */
const THUMBNAIL_SIZE = 640;

type Thumbnail = { kind: 'image'; url: string } | { kind: 'empty' } | { kind: 'error' };

/** One per board and edit time, for the whole session; an edited board gets a new one. */
const cache = new Map<string, Promise<Thumbnail>>();
/** Thumbnails are made one at a time so opening the home never freezes the app. */
let queue: Promise<unknown> = Promise.resolve();

async function render(path: string, dark: boolean): Promise<Thumbnail> {
  const file = await window.vision.fs.readFile(path);
  if (file.kind !== 'text') return { kind: 'error' };
  const parsed = parseBoardText(file.content);
  if (parsed.kind === 'empty') return { kind: 'empty' };
  if (parsed.kind !== 'scene') return { kind: 'error' };
  // Loaded only when the home needs a picture: Excalidraw is big.
  const { exportToBlob, restore } = await import('@excalidraw/excalidraw');
  const scene = restore(parsed.scene as Parameters<typeof restore>[0], null, null);
  const elements = scene.elements.filter((element) => !element.isDeleted);
  if (elements.length === 0) return { kind: 'empty' };
  const blob = await exportToBlob({
    elements,
    files: scene.files,
    appState: { exportBackground: false, exportWithDarkMode: dark },
    maxWidthOrHeight: THUMBNAIL_SIZE,
    exportPadding: 24,
  });
  return { kind: 'image', url: URL.createObjectURL(blob) };
}

/** An edited board's old picture is never shown again: free it. */
function forgetOlder(path: string): void {
  for (const [key, old] of cache) {
    if (!key.startsWith(`${path}|`)) continue;
    cache.delete(key);
    void old.then((thumbnail) => thumbnail.kind === 'image' && URL.revokeObjectURL(thumbnail.url));
  }
}

export function boardThumbnail(path: string, modified: number, dark: boolean): Promise<Thumbnail> {
  const key = `${path}|${modified}|${dark}`;
  let thumbnail = cache.get(key);
  if (!thumbnail) {
    forgetOlder(path);
    thumbnail = queue.then(() => render(path, dark)).catch((): Thumbnail => ({ kind: 'error' }));
    queue = thumbnail;
    cache.set(key, thumbnail);
  }
  return thumbnail;
}

export type { Thumbnail };
