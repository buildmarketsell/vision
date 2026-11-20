import { createPortal } from 'react-dom';
import { Copy, ExternalLink, FolderSearch, ListTree } from 'lucide-react';
import { openFile } from '../core/dockActions';
import { revealInFiles } from '../core/reveal';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

const ICON = { size: 15, strokeWidth: 1.5 };
/** Short enough that a click still feels instant, long enough to tell it from a double-click. */
const DOUBLE_CLICK_MS = 250;

export interface FileLinkTarget {
  path: string;
  isDirectory: boolean;
  x: number;
  y: number;
}

let pendingClick: ReturnType<typeof setTimeout> | undefined;

/**
 * A file link's single click waits a moment: a double-click shows the menu instead (Dan, 2026-11-20),
 * and must not also open the file. Call `cancelSingleClick` from the double-click.
 */
export function afterSingleClick(event: { detail: number }, open: () => void): void {
  clearTimeout(pendingClick);
  if (event.detail <= 1) pendingClick = setTimeout(open, DOUBLE_CLICK_MS);
}

export function cancelSingleClick(): void {
  clearTimeout(pendingClick);
}

function items(target: FileLinkTarget): ContextMenuItem[] {
  return [
    { label: 'Show in Files', icon: <ListTree {...ICON} />, onSelect: () => revealInFiles(target.path) },
    ...(target.isDirectory ? [] : [{ label: 'Open', icon: <ExternalLink {...ICON} />, onSelect: () => openFile(target.path) }]),
    { label: 'Reveal in Finder', icon: <FolderSearch {...ICON} />, onSelect: () => window.vision.fs.revealInFinder(target.path) },
    { label: 'Copy Path', icon: <Copy {...ICON} />, onSelect: () => void navigator.clipboard.writeText(target.path) },
  ];
}

/** The menu a double-click or right-click on a file link in the chat opens. On the body: dock panes misplace fixed-position children. */
export function FileLinkMenu({ target, onClose }: { target: FileLinkTarget; onClose: () => void }) {
  return createPortal(<ContextMenu x={target.x} y={target.y} items={items(target)} onClose={onClose} />, document.body);
}
