/**
 * Dragging files out of the file tree. The drag is a real macOS file drag (so Finder, Google Drive and
 * other apps take the files), which means VISION's own drop targets also see plain files. They ask
 * `draggedTreePaths` to tell "files from the tree" (mention or link them) from "files from Finder" (copy them).
 */

let dragged: string[] = [];

export function startTreeDrag(paths: string[]): void {
  dragged = paths;
  window.vision.fs.startDrag(paths);
}

/** The tree paths being dropped, when the dropped files are exactly the ones the tree started dragging; else null. */
export function draggedTreePaths(files: FileList | File[] | undefined): string[] | null {
  const list = [...(files ?? [])];
  if (dragged.length === 0 || list.length !== dragged.length) return null;
  const paths = list.map((file) => window.vision.app.pathForFile(file));
  return paths.every((path) => dragged.includes(path)) ? paths : null;
}
