import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import './board.css';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { parseBoardText, type BoardScene } from '../boardFile';
import { CANVAS_BACKGROUND, DEFAULT_STYLE } from '../boardStyle';
import { addStickyNote, applyStyle, currentItemState } from './boardActions';
import { BoardTopLeft, BoardZoom } from './BoardCorners';
import { BoardToolbar } from './BoardToolbar';
import { watchBoard } from './boardWatch';
import { StylePanel } from './StylePanel';
import { useBoardChrome } from './useBoardChrome';

// Fonts are copied next to the page at install time (scripts/postinstall.mjs), so boards work offline.
window.EXCALIDRAW_ASSET_PATH = new URL('excalidraw/', window.location.href).href;

const SAVE_DELAY_MS = 300;
/** Below this width the style panel shows only while drawing or with something selected. */
const ROOMY_WIDTH = 900;
const STYLELESS_TOOLS = new Set(['selection', 'hand', 'eraser', 'laser']);

/** The tldraw feel for new shapes: its default style, round corners, real arrowheads, its canvas color. */
const TLDRAW_DEFAULTS: Partial<AppState> = {
  ...currentItemState(DEFAULT_STYLE),
  currentItemRoundness: 'round',
  currentItemEndArrowhead: 'arrow',
  viewBackgroundColor: CANVAS_BACKGROUND,
};

type Restored = ReturnType<typeof restore>;

function restoreScene(scene: BoardScene | null): Restored {
  // restore() checks and repairs every element, so a hand-edited file can't break the canvas.
  return restore(scene as Parameters<typeof restore>[0], null, null);
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName));
}

interface BoardCanvasProps {
  path: string;
  initialText: string;
  initialScene: BoardScene | null;
}

export default function BoardCanvas({ path, initialText, initialScene }: BoardCanvasProps) {
  const scheme = useAppTheme((state) => state.active.scheme);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSaved = useRef(initialText);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const chrome = useBoardChrome(api);
  const container = () => wrapper.current?.querySelector<HTMLElement>('.excalidraw') ?? null;

  const initialData = useMemo(() => {
    const restored = restoreScene(initialScene);
    return { elements: restored.elements, files: restored.files, appState: { ...restored.appState, ...TLDRAW_DEFAULTS } };
  }, [initialScene]);

  useEffect(() => {
    if (!api) return;
    const save = () => {
      saveTimer.current = null;
      const text = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
      if (text === lastSaved.current) return;
      lastSaved.current = text;
      void window.vision.fs.writeFile(path, text).then((result) => setSaveError(result.ok ? null : result.error));
    };
    const unsubscribeChange = api.onChange(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
    });
    // Someone else (Claude, git) changed the file: show their version unless an edit is waiting to be saved.
    const unwatch = watchBoard(path, async () => {
      if (saveTimer.current) return;
      const result = await window.vision.fs.readFile(path);
      if (result.kind !== 'text' || result.content === lastSaved.current) return;
      const parsed = parseBoardText(result.content);
      if (parsed.kind !== 'scene') return;
      const restored = restoreScene(parsed.scene);
      lastSaved.current = result.content;
      api.addFiles(Object.values(restored.files));
      api.updateScene({ elements: restored.elements });
    });
    return () => {
      unsubscribeChange();
      unwatch();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        save();
      }
    };
  }, [api, path]);

  const addNote = useCallback(() => {
    if (api) addStickyNote(api, container(), chrome.style);
  }, [api, chrome.style]);

  return (
    <div className="flex h-full flex-col">
      {saveError && (
        <div role="alert" className="mx-3 my-2 rounded-lg bg-(--color-danger-soft) px-3 py-2" style={{ fontSize: 'var(--size-small)' }}>
          Could not save this board: {saveError}. Your drawing is still here; the next change tries again.
        </div>
      )}
      <div
        ref={wrapper}
        className="board-stage relative min-h-0 flex-1"
        onKeyDown={(event) => {
          // N = sticky note, as in tldraw (Excalidraw doesn't use the key).
          if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
            event.preventDefault();
            addNote();
          }
        }}
      >
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          theme={scheme}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
        />
        {api && (
          <>
            <BoardTopLeft api={api} getContainer={container} hasSelection={chrome.hasSelection} />
            {(chrome.width >= ROOMY_WIDTH || chrome.hasSelection || !STYLELESS_TOOLS.has(chrome.tool)) && (
              <StylePanel style={chrome.style} onChange={(style) => applyStyle(api, style)} />
            )}
            <BoardZoom api={api} zoom={chrome.zoom} />
            <BoardToolbar activeTool={chrome.tool} onPickTool={(type) => api.setActiveTool({ type } as Parameters<typeof api.setActiveTool>[0])} onAddNote={addNote} />
          </>
        )}
      </div>
    </div>
  );
}
