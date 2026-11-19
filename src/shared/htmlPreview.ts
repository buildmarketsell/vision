/** Pure rules for previewing web pages from the open folder (HTML preview). */

export const PREVIEW_SCHEME = 'vision-preview';

const WEB_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'map', 'wasm', 'txt', 'xml', 'webmanifest',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a',
]);

export function isHtmlFile(path: string): boolean {
  return /\.html?$/i.test(path);
}

/**
 * Whether a page preview may load this file: web file types only, and nothing in a hidden
 * file or folder, so a page's scripts can never read `.env`, `.git` or keys.
 */
export function isPreviewableFile(path: string): boolean {
  if (path.split('/').some((part) => part.startsWith('.'))) return false;
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf('/') && WEB_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

/** The address a preview frame loads; relative links in the page resolve next to the file. */
export function previewUrl(absolutePath: string): string {
  return `${PREVIEW_SCHEME}://local${absolutePath.split('/').map(encodeURIComponent).join('/')}`;
}
