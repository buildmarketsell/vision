import { describe, expect, it } from 'vitest';
import { isBoardFile, nextBoardName, parseBoardText } from '../../src/features/board/boardFile';

describe('board files', () => {
  it('recognises .excalidraw files only', () => {
    expect(isBoardFile('/a/Plan.excalidraw')).toBe(true);
    expect(isBoardFile('/a/Plan.EXCALIDRAW')).toBe(true);
    expect(isBoardFile('/a/plan.md')).toBe(false);
    expect(isBoardFile('/a/plan.excalidraw.md')).toBe(false);
  });

  it('picks the first free board name', () => {
    expect(nextBoardName([])).toBe('Untitled board.excalidraw');
    expect(nextBoardName(['untitled board.excalidraw', 'Untitled board 2.excalidraw'])).toBe('Untitled board 3.excalidraw');
  });

  it('treats an empty file as a new board', () => {
    expect(parseBoardText('  \n')).toEqual({ kind: 'empty' });
  });

  it('reads an Excalidraw scene', () => {
    const text = JSON.stringify({ type: 'excalidraw', elements: [{ id: 'a' }], appState: { gridSize: 20 }, files: {} });
    expect(parseBoardText(text)).toEqual({
      kind: 'scene',
      scene: { elements: [{ id: 'a' }], appState: { gridSize: 20 }, files: {} },
    });
  });

  it('refuses files that are not boards, so they are never saved over', () => {
    expect(parseBoardText('{oops').kind).toBe('invalid');
    expect(parseBoardText('{"type":"other","elements":[]}').kind).toBe('invalid');
    expect(parseBoardText('[]').kind).toBe('invalid');
  });
});
