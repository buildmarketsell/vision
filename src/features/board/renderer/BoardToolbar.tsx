import { ArrowUpRight, Circle, Diamond, Eraser, Frame, Hand, Minus, MousePointer2, Pencil, Square, StickyNote, Type, type LucideIcon } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

type ToolType = Parameters<ExcalidrawImperativeAPI['setActiveTool']>[0] extends infer T ? (T extends { type: infer U } ? U : never) : never;

interface Tool {
  type: ToolType | 'note';
  label: string;
  shortcut: string;
  icon: LucideIcon;
}

/** tldraw's order: select, hand, draw, eraser, arrow, text, note, then shapes. */
const TOOLS: Tool[] = [
  { type: 'selection', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { type: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
  { type: 'freedraw', label: 'Draw', shortcut: 'P', icon: Pencil },
  { type: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { type: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
  { type: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { type: 'note', label: 'Sticky note', shortcut: 'N', icon: StickyNote },
  { type: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
  { type: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
  { type: 'diamond', label: 'Diamond', shortcut: 'D', icon: Diamond },
  { type: 'line', label: 'Line', shortcut: 'L', icon: Minus },
  { type: 'frame', label: 'Frame', shortcut: 'F', icon: Frame },
];

interface BoardToolbarProps {
  activeTool: string;
  onPickTool: (type: ToolType) => void;
  onAddNote: () => void;
}

/** The bottom toolbar, as in tldraw. */
export function BoardToolbar({ activeTool, onPickTool, onAddNote }: BoardToolbarProps) {
  return (
    <div className="board-panel board-toolbar" role="toolbar" aria-label="Board tools">
      {TOOLS.map(({ type, label, shortcut, icon: Icon }) => (
        <button
          key={type}
          className="board-button"
          title={`${label} — ${shortcut}`}
          aria-label={label}
          aria-pressed={type === activeTool}
          onClick={() => (type === 'note' ? onAddNote() : onPickTool(type))}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
