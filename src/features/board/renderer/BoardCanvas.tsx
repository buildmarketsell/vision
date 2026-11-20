import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, hashElementsVersion, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import './board.css';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { isBoardEmbeddable } from '../boardEmbeds';
import { parseBoardText, type BoardScene } from '../boardFile';
import { CANVAS_BACKGROUND, DEFAULT_STYLE } from '../boardStyle';
import { addStickyNote, applyStyle, currentItemState } from './boardActions';
import { BoardTopLeft, BoardZoom } from './BoardCorners';
import { addVideos, renderBoardEmbed, videoFiles } from './boardMedia';
import { BoardToolbar } from './BoardToolbar';
import { watchBoard } from './boardWatch';
import { StylePanel } from './StylePanel';
import { useBoardChrome } from './useBoardChrome';
import { useDotGrid } from './useDotGrid';
import { useSmoothZoom } from './useSmoothZoom';
import { useMacFonts } from './macFonts';

// Fonts are copied next to the page at install time (scripts/postinstall.mjs), so boards work offline.
window.EXCALIDRAW_ASSET_PATH = new URL('excalidraw/', window.location.href).href;
// A trackpad sends more scroll events than the screen has frames; draw the board once per frame, not once per event.
window.EXCALIDRAW_THROTTLE_RENDER = true;

const SAVE_DELAY_MS = 300;
/** Below this width the style panel shows only while drawing or with something selected. */
const ROOMY_WIDTH = 900;
/** Below this width the zoom buttons would sit under the toolbar; pinch and the menu's "Zoom to fit" still work. */
const ZOOM_BUTTONS_WIDTH = 760;
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

/** Changes whenever something saved in the file changes: shapes, pasted files, or the style for new shapes. */
function contentKey(api: ExcalidrawImperativeAPI): string {
  const state = api.getAppState();
  const current = Object.entries(state).filter(([key]) => key.startsWith('currentItem'));
  return `${hashElementsVersion(api.getSceneElementsIncludingDeleted())}|${Object.keys(api.getFiles()).length}|${JSON.stringify(current)}`;
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
  const [mediaError, setMediaError] = useState<string | null>(null);
  const lastSaved = useRef(initialText);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLCanvasElement>(null);
  const chrome = useBoardChrome(api);
  useDotGrid(api, dots, scheme);
  useSmoothZoom(api, wrapper);
  // Text in a Mac font needs Excalidraw to know that font before the first draw.
  const macFonts = useMacFonts();
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
    // onChange also fires on every scroll, zoom and pointer move: only a real edit schedules a save,
    // so panning a board full of images never re-writes its (large) file.
    let lastContent = contentKey(api);
    const unsubscribeChange = api.onChange(() => {
      const content = contentKey(api);
      if (content === lastContent) return;
      lastContent = content;
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

  // Built once per board and theme: the toolbar and zoom label change on every zoom step,
  // and re-rendering Excalidraw with them would redraw the whole board each frame.
  const board = useMemo(
    () => (
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        theme={scheme}
        validateEmbeddable={isBoardEmbeddable}
        renderEmbeddable={(element) => renderBoardEmbed(path, element)}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
      />
    ),
    [initialData, scheme, path],
  );

  const addNote = useCallback(() => {
    if (api) addStickyNote(api, container(), chrome.style);
  }, [api, chrome.style]);

  const placeVideos = useCallback(
    (files: File[], client?: { clientX: number; clientY: number }) => {
      if (!api) return;
      const { scrollX, scrollY, zoom, width, height, offsetLeft, offsetTop } = api.getAppState();
      const viewX = client ? client.clientX - offsetLeft : width / 2;
      const viewY = client ? client.clientY - offsetTop : height / 2;
      void addVideos(api, path, files, { x: viewX / zoom.value - scrollX, y: viewY / zoom.value - scrollY }).then(setMediaError);
    },
    [api, path],
  );

  return (
    <div className="flex h-full flex-col">
      {mediaError && (
        <div role="alert" className="mx-3 my-2 rounded-lg bg-(--color-danger-soft) px-3 py-2" style={{ fontSize: 'var(--size-small)' }}>
          {mediaError}
        </div>
      )}
      {saveError && (
        <div role="alert" className="mx-3 my-2 rounded-lg bg-(--color-danger-soft) px-3 py-2" style={{ fontSize: 'var(--size-small)' }}>
          Could not save this board: {saveError}. Your drawing is still here; the next change tries again.
        </div>
      )}
      <div
        ref={wrapper}
        className="board-stage relative min-h-0 flex-1"
        // Excalidraw only takes images; video files become players here instead.
        onDropCapture={(event) => {
          const videos = videoFiles(event.dataTransfer.files);
          if (videos.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          placeVideos(videos, event);
        }}
        // Read here, before Excalidraw's own paste handler: pasted files are gone once it awaits.
        onPasteCapture={(event) => {
          const videos = videoFiles(event.clipboardData.files);
          if (videos.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          placeVideos(videos);
        }}
        onKeyDown={(event) => {
          // N = sticky note, as in tldraw (Excalidraw doesn't use the key).
          if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
            event.preventDefault();
            addNote();
          }
        }}
      >
        <canvas ref={dots} className="board-dots" aria-hidden="true" />
        {macFonts === null ? (
          <div className="spinner absolute top-1/2 left-1/2" aria-label="Loading board" />
        ) : (
          board
        )}
        {api && (
          <>
            <BoardTopLeft api={api} getContainer={container} hasSelection={chrome.hasSelection} path={path} />
            {(chrome.width >= ROOMY_WIDTH || chrome.hasSelection || !STYLELESS_TOOLS.has(chrome.tool)) && (
              <StylePanel style={chrome.style} onChange={(style, final) => applyStyle(api, style, final)} />
            )}
            {chrome.width >= ZOOM_BUTTONS_WIDTH && <BoardZoom api={api} zoom={chrome.zoom} />}
            <BoardToolbar activeTool={chrome.tool} onPickTool={(type) => api.setActiveTool({ type } as Parameters<typeof api.setActiveTool>[0])} onAddNote={addNote} />
          </>
        )}
      </div>
    </div>
  );
}
