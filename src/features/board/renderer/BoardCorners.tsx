import { useState } from 'react';
import { ClipboardCopy, Copy, Keyboard, Maximize, Menu, Minus, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { clearBoard, copyAsImage, pressKey, zoomTo, zoomToFit } from './boardActions';

const ICON = { size: 16, strokeWidth: 1.75 };
const ZOOM_STEP = 1.25;

interface CornerProps {
  api: ExcalidrawImperativeAPI;
  /** Excalidraw's container element, looked up when a button is pressed. */
  getContainer: () => HTMLElement | null;
}

/** Top left, as in tldraw: the menu, then undo, redo, delete and duplicate. */
export function BoardTopLeft({ api, getContainer, hasSelection }: CornerProps & { hasSelection: boolean }) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const items: ContextMenuItem[] = [
    { label: 'Copy as image', icon: <ClipboardCopy {...ICON} />, onSelect: () => void copyAsImage(api) },
    { label: 'Zoom to fit', icon: <Maximize {...ICON} />, onSelect: () => zoomToFit(api) },
    { label: 'Keyboard shortcuts', icon: <Keyboard {...ICON} />, onSelect: () => pressKey(getContainer(), '?', { shift: true }) },
    { label: 'Clear board', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => clearBoard(api) },
  ];
  return (
    <div className="board-panel board-top-left">
      <button
        className="board-button"
        aria-label="Board menu"
        aria-expanded={menuAt !== null}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenuAt({ x: rect.left, y: rect.bottom + 6 });
        }}
      >
        <Menu {...ICON} />
      </button>
      <div className="board-vertical-divider" />
      <button className="board-button" title="Undo — ⌘Z" aria-label="Undo" onClick={() => pressKey(getContainer(), 'z', { meta: true })}>
        <Undo2 {...ICON} />
      </button>
      <button className="board-button" title="Redo — ⇧⌘Z" aria-label="Redo" onClick={() => pressKey(getContainer(), 'z', { meta: true, shift: true })}>
        <Redo2 {...ICON} />
      </button>
      <button className="board-button" title="Delete — ⌫" aria-label="Delete" disabled={!hasSelection} onClick={() => pressKey(getContainer(), 'Delete')}>
        <Trash2 {...ICON} />
      </button>
      <button className="board-button" title="Duplicate — ⌘D" aria-label="Duplicate" disabled={!hasSelection} onClick={() => pressKey(getContainer(), 'd', { meta: true })}>
        <Copy {...ICON} />
      </button>
      {menuAt && <ContextMenu x={menuAt.x} y={menuAt.y} items={items} onClose={() => setMenuAt(null)} />}
    </div>
  );
}

/** Bottom left: zoom out, the zoom level (click for 100%), zoom in, zoom to fit. */
export function BoardZoom({ api, zoom }: { api: ExcalidrawImperativeAPI; zoom: number }) {
  return (
    <div className="board-panel board-zoom">
      <button className="board-button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomTo(api, zoom / ZOOM_STEP)}>
        <Minus {...ICON} />
      </button>
      <button className="board-button board-zoom-level" title="Reset zoom to 100%" aria-label="Reset zoom" onClick={() => zoomTo(api, 1)}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="board-button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomTo(api, zoom * ZOOM_STEP)}>
        <Plus {...ICON} />
      </button>
      <button className="board-button" title="Zoom to fit — ⇧1" aria-label="Zoom to fit" onClick={() => zoomToFit(api)}>
        <Maximize {...ICON} />
      </button>
    </div>
  );
}
