import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, FONT_FAMILY, MainMenu, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import './board.css';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { parseBoardText, type BoardScene } from '../boardFile';
import { watchBoard } from './boardWatch';

// Fonts are copied next to the page at install time (scripts/postinstall.mjs), so boards work offline.
window.EXCALIDRAW_ASSET_PATH = new URL('excalidraw/', window.location.href).href;

const SAVE_DELAY_MS = 300;

/** The tldraw feel: clean lines, a clean font, rounded corners, real arrowheads. */
const TLDRAW_STYLE: Partial<AppState> = {
  currentItemRoughness: 0,
  currentItemFontFamily: FONT_FAMILY.Nunito,
  currentItemStrokeWidth: 2,
  currentItemRoundness: 'round',
  currentItemEndArrowhead: 'arrow',
};

type Restored = ReturnType<typeof restore>;

function restoreScene(scene: BoardScene | null): Restored {
  // restore() checks and repairs every element, so a hand-edited file can't break the canvas.
  return restore(scene as Parameters<typeof restore>[0], null, null);
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

  const initialData = useMemo(() => {
    const restored = restoreScene(initialScene);
    return { elements: restored.elements, files: restored.files, appState: { ...restored.appState, ...TLDRAW_STYLE } };
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

  return (
    <div className="flex h-full flex-col">
      {saveError && (
        <div role="alert" className="mx-3 my-2 rounded-lg bg-(--color-danger-soft) px-3 py-2" style={{ fontSize: 'var(--size-small)' }}>
          Could not save this board: {saveError}. Your drawing is still here; the next change tries again.
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          theme={scheme}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}
