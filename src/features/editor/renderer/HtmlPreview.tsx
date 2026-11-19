import { useEffect, useState } from 'react';
import { previewUrl } from '../../../shared/htmlPreview';
import { baseName, parentPath, useWorkspace } from '../../../renderer/core/workspaceStore';

const RELOAD_DELAY_MS = 150;

/**
 * The page as a browser shows it, from the file on disk. Sandboxed without same-origin, so its scripts
 * can't reach VISION; the preview scheme only serves web files inside the open folder. Reloads after
 * every save and whenever a file next to it (CSS, JS, images) changes.
 */
export function HtmlPreview({ path, saved, reloadToken }: { path: string; saved: string; reloadToken: number }) {
  const [diskVersion, setDiskVersion] = useState(0);
  const dir = parentPath(path);

  useEffect(() => {
    const key = `html-preview:${path}`;
    useWorkspace.getState().setWatched(key, [dir]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = window.vision.fs.onChange((change) => {
      if (!change.path.startsWith(`${dir}/`)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setDiskVersion((version) => version + 1), RELOAD_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      useWorkspace.getState().setWatched(key, []);
    };
  }, [path, dir]);

  return (
    <iframe
      // A new key reloads the page; `saved` changes after each save.
      key={`${saved.length}:${hash(saved)}:${diskVersion}:${reloadToken}`}
      src={previewUrl(path)}
      title={`Preview of ${baseName(path)}`}
      sandbox="allow-scripts allow-forms allow-modals"
      className="h-full w-full border-0 bg-white"
    />
  );
}

/** A cheap fingerprint of the saved text, so an edit that keeps the length still reloads. */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) | 0;
  return value;
}
