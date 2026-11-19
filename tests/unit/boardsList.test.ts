import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boardLabel } from '../../src/features/board/boardFile';
import { findFiles, isFileExtension } from '../../src/main/workspace/findFiles';

describe('boardLabel', () => {
  it('shows the path inside the folder without .excalidraw', () => {
    expect(boardLabel('/w', '/w/plans/Launch.excalidraw')).toBe('plans/Launch');
    expect(boardLabel('/w/', '/w/Ideas.EXCALIDRAW')).toBe('Ideas');
  });
});

describe('findFiles', () => {
  it('finds boards in subfolders and skips hidden folders and node_modules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vision-find-'));
    for (const dir of ['a/b', '.git', 'node_modules/x']) mkdirSync(join(root, dir), { recursive: true });
    for (const file of ['Top.excalidraw', 'a/b/Deep.excalidraw', 'a/note.md', '.git/Hidden.excalidraw', 'node_modules/x/Dep.excalidraw']) {
      writeFileSync(join(root, file), '');
    }
    const result = await findFiles(root, '.excalidraw');
    expect(result).toEqual({ ok: true, value: [join(root, 'a/b/Deep.excalidraw'), join(root, 'Top.excalidraw')] });
  });

  it('reports a folder that cannot be read', async () => {
    const result = await findFiles(join(tmpdir(), 'vision-missing-folder-xyz'), '.excalidraw');
    expect(result.ok).toBe(false);
  });

  it('accepts only plain extensions', () => {
    expect(isFileExtension('.excalidraw')).toBe(true);
    expect(isFileExtension('excalidraw')).toBe(false);
    expect(isFileExtension('./../x')).toBe(false);
    expect(isFileExtension(5)).toBe(false);
  });
});
