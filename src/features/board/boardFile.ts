/** Pure helpers for board files (Excalidraw's `.excalidraw` JSON). No Excalidraw import, so tests stay light. */

export const BOARD_EXTENSION = '.excalidraw';
const BASE_NAME = 'Untitled board';

export function isBoardFile(path: string): boolean {
  return path.toLowerCase().endsWith(BOARD_EXTENSION);
}

/** "Untitled board.excalidraw", or "Untitled board 2.excalidraw" and up when that name is taken. */
export function nextBoardName(existingNames: string[]): string {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  for (let number = 1; ; number += 1) {
    const name = `${number === 1 ? BASE_NAME : `${BASE_NAME} ${number}`}${BOARD_EXTENSION}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

export interface BoardScene {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export type ParsedBoard =
  | { kind: 'empty' }
  | { kind: 'scene'; scene: BoardScene }
  | { kind: 'invalid'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a board file's text. An empty file is a new board. Anything that isn't
 * Excalidraw JSON is "invalid", and the board must not save over it.
 */
export function parseBoardText(text: string): ParsedBoard {
  if (text.trim() === '') return { kind: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'invalid', message: 'The file is not valid JSON.' };
  }
  if (!isRecord(data) || data.type !== 'excalidraw' || !Array.isArray(data.elements)) {
    return { kind: 'invalid', message: 'The file is not an Excalidraw board.' };
  }
  return {
    kind: 'scene',
    scene: {
      elements: data.elements,
      appState: isRecord(data.appState) ? data.appState : undefined,
      files: isRecord(data.files) ? data.files : undefined,
    },
  };
}
