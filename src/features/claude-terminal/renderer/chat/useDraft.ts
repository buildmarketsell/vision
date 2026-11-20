import { useState, type ClipboardEvent, type DragEvent } from 'react';
import { isImageMediaType, MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE, type ChatImage } from '../../../../shared/claudeChat';
import { relativeParts, useWorkspace } from '../../../../renderer/core/workspaceStore';
import { draggedTreePaths } from '../../../../renderer/core/treeDrag';

const ERROR_VISIBLE_MS = 4000;

export interface Draft {
  text: string;
  setText: (text: string) => void;
  images: ChatImage[];
  removeImage: (index: number) => void;
  error: string | null;
  clear: () => void;
  onPaste: (event: ClipboardEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  /** Files picked in the actions menu: images are attached, anything else is mentioned by path. */
  addFiles: (files: File[], mentionOnly?: boolean) => void;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

/** How a dropped path is written in the message: relative inside the open folder, full path outside it. */
export function mentionFor(folder: string, path: string): string {
  const inside = path === folder || path.startsWith(`${folder}/`);
  return `@${inside ? relativeParts(folder, path).join('/') : path} `;
}

function appendMention(current: string, mention: string): string {
  return current && !current.endsWith(' ') && !current.endsWith('\n') ? `${current} ${mention}` : current + mention;
}

/** What you're typing to Claude, plus pasted or dropped images. Drop anywhere in the chat, no Shift needed. */
export function useDraft(): Draft {
  const folder = useWorkspace((state) => state.folder);
  const [text, setText] = useState('');
  const [images, setImages] = useState<ChatImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError((current) => (current === message ? null : current)), ERROR_VISIBLE_MS);
  };

  const attach = async (file: File) => {
    if (!isImageMediaType(file.type)) return;
    if (file.size > MAX_IMAGE_BYTES) return showError(`${file.name || 'That image'} is over 5 MB.`);
    try {
      const data = await readAsBase64(file);
      setImages((current) => {
        if (current.length >= MAX_IMAGES_PER_MESSAGE) {
          showError(`Up to ${MAX_IMAGES_PER_MESSAGE} images per message.`);
          return current;
        }
        return [...current, { mediaType: file.type as ChatImage['mediaType'], data }];
      });
    } catch {
      showError('Could not read that image.');
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const pasted = [...event.clipboardData.files].filter((file) => isImageMediaType(file.type));
    if (pasted.length === 0) return;
    event.preventDefault();
    pasted.forEach((file) => void attach(file));
  };

  const onDragOver = (event: DragEvent) => {
    const types = event.dataTransfer.types;
    if (!types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (event: DragEvent) => {
    const files = [...event.dataTransfer.files];
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    // Files from the file tree are mentioned by path; images from Finder are attached.
    const treePaths = draggedTreePaths(files);
    if (treePaths) return treePaths.forEach((path) => setText((current) => appendMention(current, mentionFor(folder, path))));
    addFiles(files);
  };

  function addFiles(files: File[], mentionOnly = false) {
    for (const file of files) {
      if (!mentionOnly && isImageMediaType(file.type)) void attach(file);
      else setText((current) => appendMention(current, mentionFor(folder, window.vision.app.pathForFile(file))));
    }
  }

  return {
    text,
    setText,
    images,
    removeImage: (index) => setImages((current) => current.filter((_, position) => position !== index)),
    error,
    clear: () => {
      setText('');
      setImages([]);
    },
    onPaste,
    onDragOver,
    onDrop,
    addFiles,
  };
}
