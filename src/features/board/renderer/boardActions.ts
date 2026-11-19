import { CaptureUpdateAction, convertToExcalidrawElements, exportToClipboard, newElementWith, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { NOTE_TEXT, noteFill, styleToCurrentItem, styleToFields, type BoardStyle } from '../boardStyle';

type Api = ExcalidrawImperativeAPI;
type Zoom = AppState['zoom']['value'];

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const NOTE_SIZE = 200;

/**
 * Excalidraw has no public undo / delete / duplicate API, so the buttons press its own
 * keyboard shortcuts on the canvas container. Same behavior as typing them.
 */
export function pressKey(container: HTMLElement | null, key: string, modifiers: { meta?: boolean; shift?: boolean } = {}): void {
  container?.dispatchEvent(
    new KeyboardEvent('keydown', { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, metaKey: modifiers.meta, shiftKey: modifiers.shift, bubbles: true, cancelable: true }),
  );
}

type CurrentItemKey = keyof ReturnType<typeof styleToCurrentItem>;

/** Excalidraw's "current item" fields, typed as its app state (the font id is one Excalidraw knows). */
export function currentItemState(style: BoardStyle): Pick<AppState, CurrentItemKey> {
  return styleToCurrentItem(style) as Pick<AppState, CurrentItemKey>;
}

function selectedIds(api: Api): Set<string> {
  const { selectedElementIds } = api.getAppState();
  return new Set(Object.keys(selectedElementIds).filter((id) => selectedElementIds[id]));
}

/** Sticky notes are rectangles marked in `customData`, so they stay notes when restyled. */
export function isNote(element: ExcalidrawElement): boolean {
  return element.customData?.['boardNote'] === true;
}

function fieldsFor(element: ExcalidrawElement, style: BoardStyle, noteIds: Set<string>) {
  const fields = styleToFields(style);
  if (element.type === 'text') {
    const inNote = element.containerId !== null && noteIds.has(element.containerId);
    return { strokeColor: inNote ? NOTE_TEXT : fields.strokeColor, fontSize: fields.fontSize, fontFamily: fields.fontFamily };
  }
  if (isNote(element)) return { backgroundColor: noteFill(style.color) };
  const { strokeColor, backgroundColor, fillStyle, strokeStyle, roughness, strokeWidth } = fields;
  return { strokeColor, backgroundColor, fillStyle, strokeStyle, roughness, strokeWidth };
}

/**
 * Applies a style to the selection (and the labels inside it) and makes it the style for new shapes.
 * `final` false = a preview while a picker is open; the last, final call makes it one undo step.
 */
export function applyStyle(api: Api, style: BoardStyle, final = true): void {
  const selected = selectedIds(api);
  const touches = (element: ExcalidrawElement) =>
    selected.has(element.id) || (element.type === 'text' && element.containerId !== null && selected.has(element.containerId));
  const elements = api.getSceneElementsIncludingDeleted();
  const noteIds = new Set(elements.filter(isNote).map((element) => element.id));
  const changed = elements.map((element) => (touches(element) ? newElementWith(element, fieldsFor(element, style, noteIds) as Parameters<typeof newElementWith>[1]) : element));
  api.updateScene({
    // Re-measures text so a new font or size doesn't leave a wrongly sized box (Excalidraw only does it with repairBindings on).
    elements: selected.size > 0 ? restoreElements(changed, null, { refreshDimensions: true, repairBindings: true }) : undefined,
    appState: currentItemState(style),
    captureUpdate: final ? CaptureUpdateAction.IMMEDIATELY : CaptureUpdateAction.EVENTUALLY,
  });
}

/** A tldraw-style sticky note in the middle of the view, ready to type in. */
export function addStickyNote(api: Api, container: HTMLElement | null, style: BoardStyle): void {
  const { scrollX, scrollY, zoom, width, height, currentItemStrokeColor: previousColor } = api.getAppState();
  const centerX = -scrollX + width / 2 / zoom.value;
  const centerY = -scrollY + height / 2 / zoom.value;
  const [note] = convertToExcalidrawElements([
    {
      type: 'rectangle',
      x: centerX - NOTE_SIZE / 2,
      y: centerY - NOTE_SIZE / 2,
      width: NOTE_SIZE,
      height: NOTE_SIZE,
      backgroundColor: noteFill(style.color),
      fillStyle: 'solid',
      strokeColor: 'transparent',
      roughness: 0,
      roundness: null,
      customData: { boardNote: true },
    },
  ]);
  if (!note) return;
  api.setActiveTool({ type: 'selection' });
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), note],
    appState: { selectedElementIds: { [note.id]: true }, currentItemStrokeColor: NOTE_TEXT },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  // The note's text is dark; once typing ends, new shapes go back to the color picked before.
  let typing = false;
  const stopWatching = api.onChange((_elements, appState) => {
    if (appState.editingTextElement) typing = true;
    else if (typing) {
      stopWatching();
      api.updateScene({ appState: { currentItemStrokeColor: previousColor } });
    }
  });
  // Enter on a selected shape starts typing its label.
  requestAnimationFrame(() => pressKey(container, 'Enter'));
}

/** Zooms around the middle of the view. */
export function zoomTo(api: Api, nextZoom: number): void {
  const state = api.getAppState();
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const old = state.zoom.value;
  const halfWidth = state.width / 2;
  const halfHeight = state.height / 2;
  api.updateScene({
    appState: {
      zoom: { value: next as Zoom },
      scrollX: state.scrollX + halfWidth / next - halfWidth / old,
      scrollY: state.scrollY + halfHeight / next - halfHeight / old,
    },
  });
}

export function zoomToFit(api: Api): void {
  api.scrollToContent(undefined, { fitToContent: true, animate: true });
}

export async function copyAsImage(api: Api): Promise<void> {
  await exportToClipboard({ elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles(), type: 'png' });
  api.setToast({ message: 'Board copied as an image' });
}

/** Clears the board in one undoable step (⌘Z brings it back). */
export function clearBoard(api: Api): void {
  api.updateScene({ elements: [], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
}
