import type { editor as MonacoNs, IRange } from 'monaco-editor';
import { relativeImageLink } from '../../../shared/markdownImages';
import { parentPath, useWorkspace } from '../../../renderer/core/workspaceStore';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

function imageFiles(list: FileList | undefined | null): File[] {
  return Array.from(list ?? []).filter((file) => file.type in MIME_EXTENSIONS);
}

function isInOpenFolder(path: string): boolean {
  const folder = useWorkspace.getState().folder;
  return folder !== null && path.startsWith(`${folder}/`);
}

/** The Markdown for one image: link it where it is when it's already in the folder, otherwise save a copy next to the note. */
async function imageMarkdown(notePath: string, file: File): Promise<string | null> {
  const original = window.vision.app.pathForFile(file);
  let target = original && isInOpenFolder(original) ? original : null;
  if (!target) {
    const saved = await window.vision.fs.saveImage(notePath, new Uint8Array(await file.arrayBuffer()), MIME_EXTENSIONS[file.type] ?? 'png');
    if (!saved.ok) {
      console.error('[VISION] Could not save image:', saved.error);
      return null;
    }
    target = saved.value;
  }
  return `![](${relativeImageLink(parentPath(notePath), target)})`;
}

function insert(editor: MonacoNs.IStandaloneCodeEditor, range: IRange, text: string): void {
  editor.executeEdits('vision-image', [{ range, text, forceMoveMarkers: true }]);
  editor.focus();
}

/** Paste a screenshot or drop image files into a Markdown file: the image is saved in `images/` and linked at the cursor. */
export function enableImagePaste(editor: MonacoNs.IStandaloneCodeEditor, notePath: string): () => void {
  const node = editor.getDomNode();
  if (!node) return () => {};

  const insertImages = async (files: File[], range: IRange) => {
    const parts = await Promise.all(files.map((file) => imageMarkdown(notePath, file)));
    const text = parts.filter(Boolean).join('\n');
    if (text) insert(editor, range, text);
  };

  const onPaste = (event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData?.files);
    const selection = editor.getSelection();
    if (files.length === 0 || !selection) return;
    event.preventDefault();
    event.stopPropagation();
    void insertImages(files, selection);
  };

  const dropRange = (event: DragEvent): IRange | null => {
    const position = editor.getTargetAtClientPoint(event.clientX, event.clientY)?.position ?? editor.getPosition();
    return position ? { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column } : null;
  };

  const onDragOver = (event: DragEvent) => {
    const types = event.dataTransfer?.types ?? [];
    if (types.includes('Files')) event.preventDefault();
  };

  const onDrop = (event: DragEvent) => {
    const files = imageFiles(event.dataTransfer?.files);
    const range = dropRange(event);
    if (!range) return;
    if (files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      void insertImages(files, range);
    }
  };

  node.addEventListener('paste', onPaste, true);
  node.addEventListener('dragover', onDragOver, true);
  node.addEventListener('drop', onDrop, true);
  return () => {
    node.removeEventListener('paste', onPaste, true);
    node.removeEventListener('dragover', onDragOver, true);
    node.removeEventListener('drop', onDrop, true);
  };
}
