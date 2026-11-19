import { useEffect, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { BOARD_COLORS, DEFAULT_STYLE, fieldsToStyle, noteFill, type BoardStyle } from '../boardStyle';
import { isNote } from './boardActions';

export interface BoardChrome {
  tool: string;
  zoom: number;
  style: BoardStyle;
  hasSelection: boolean;
  /** Board width in pixels; narrow boards show the style panel only when it's needed, as tldraw does. */
  width: number;
}

const INITIAL: BoardChrome = { tool: 'selection', zoom: 1, style: DEFAULT_STYLE, hasSelection: false, width: 0 };

function styleOf(elements: readonly ExcalidrawElement[], appState: AppState): BoardStyle {
  // Shapes have no font: show (and keep) the font and size new text will get.
  const textNow = { fontFamily: appState.currentItemFontFamily, fontSize: appState.currentItemFontSize };
  const selected = elements.find((element) => appState.selectedElementIds[element.id]);
  if (selected && isNote(selected)) {
    // A note's color lives in its paper, not its (invisible) outline.
    const color = BOARD_COLORS.find(({ id }) => noteFill(id) === selected.backgroundColor)?.id ?? DEFAULT_STYLE.color;
    const { font, fontSize } = fieldsToStyle(textNow, true);
    return { ...DEFAULT_STYLE, color, font, fontSize };
  }
  if (selected) return fieldsToStyle({ ...textNow, ...(selected as Parameters<typeof fieldsToStyle>[0]) }, selected.type === 'text');
  return fieldsToStyle({
    strokeColor: appState.currentItemStrokeColor,
    backgroundColor: appState.currentItemBackgroundColor,
    fillStyle: appState.currentItemFillStyle === 'solid' ? 'solid' : 'hachure',
    strokeStyle: appState.currentItemStrokeStyle,
    roughness: appState.currentItemRoughness,
    strokeWidth: appState.currentItemStrokeWidth,
    fontFamily: appState.currentItemFontFamily,
    fontSize: appState.currentItemFontSize,
  });
}

function chromeOf(elements: readonly ExcalidrawElement[], appState: AppState): BoardChrome {
  return {
    tool: appState.activeTool.type,
    zoom: appState.zoom.value,
    style: styleOf(elements, appState),
    hasSelection: elements.some((element) => appState.selectedElementIds[element.id]),
    width: appState.width,
  };
}

/** What the toolbar and panels show; updated only when it actually changes (onChange fires on every pointer move). */
export function useBoardChrome(api: ExcalidrawImperativeAPI | null): BoardChrome {
  const [chrome, setChrome] = useState<BoardChrome>(INITIAL);
  useEffect(() => {
    if (!api) return;
    let lastKey = '';
    return api.onChange((elements, appState) => {
      const next = chromeOf(elements, appState);
      const key = JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setChrome(next);
    });
  }, [api]);
  return chrome;
}
