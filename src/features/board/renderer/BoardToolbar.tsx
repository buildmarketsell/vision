import { ArrowUpRight, Circle, Diamond, Eraser, Frame, Hand, Minus, MousePointer2, Pencil, Square, Type, type LucideIcon } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { NOTE_FILL } from '../boardStyle';

type ToolType = Parameters<ExcalidrawImperativeAPI['setActiveTool']>[0] extends infer T ? (T extends { type: infer U } ? U : never) : never;

interface Tool {
  type: ToolType;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}

/** FigJam's groups, left to right: pointing, drawing, (the sticky-note stack), shapes, text and frames. */
const BEFORE_NOTE: Tool[][] = [
  [
    { type: 'selection', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { type: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
  ],
  [
    { type: 'freedraw', label: 'Draw', shortcut: 'P', icon: Pencil },
    { type: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  ],
];
const AFTER_NOTE: Tool[][] = [
  [
    { type: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
    { type: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
    { type: 'diamond', label: 'Diamond', shortcut: 'D', icon: Diamond },
    { type: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
    { type: 'line', label: 'Line', shortcut: 'L', icon: Minus },
  ],
  [
    { type: 'text', label: 'Text', shortcut: 'T', icon: Type },
    { type: 'frame', label: 'Frame', shortcut: 'F', icon: Frame },
  ],
];

interface BoardToolbarProps {
  activeTool: string;
  onPickTool: (type: ToolType) => void;
  onAddNote: () => void;
}

function ToolGroup({ tools, activeTool, onPickTool }: { tools: Tool[]; activeTool: string; onPickTool: (type: ToolType) => void }) {
  return (
    <div className="board-tool-group">
      {tools.map(({ type, label, shortcut, icon: Icon }) => (
        <button
          key={type}
          className="board-button board-tool"
          title={`${label} — ${shortcut}`}
          aria-label={label}
          aria-pressed={type === activeTool}
          onClick={() => onPickTool(type)}
        >
          <Icon size={20} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

/** The bottom toolbar, as in FigJam: grouped tools with the sticky-note stack in the middle. */
export function BoardToolbar({ activeTool, onPickTool, onAddNote }: BoardToolbarProps) {
  const groups = (tools: Tool[][]) => tools.map((group) => <ToolGroup key={group[0]?.type} tools={group} activeTool={activeTool} onPickTool={onPickTool} />);
  return (
    <div className="board-panel board-toolbar" role="toolbar" aria-label="Board tools">
      {groups(BEFORE_NOTE)}
      <button className="board-note-tool" title="Sticky note — N" aria-label="Sticky note" onClick={onAddNote}>
        <span className="board-note-paper board-note-back" style={{ background: NOTE_FILL }} />
        <span className="board-note-paper board-note-front" style={{ background: NOTE_FILL }} />
      </button>
      {groups(AFTER_NOTE)}
    </div>
  );
}
