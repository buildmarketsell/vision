import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { moveEntry } from '../../src/main/workspace/fileSystem';

function folder(): string {
  const root = mkdtempSync(join(tmpdir(), 'vision-move-'));
  mkdirSync(join(root, 'ideas'));
  writeFileSync(join(root, 'Plan.excalidraw'), 'mine');
  return root;
}

describe('moveEntry', () => {
  it('moves a board into a folder under the same name', async () => {
    const root = folder();
    expect(await moveEntry(join(root, 'Plan.excalidraw'), join(root, 'ideas'))).toEqual({ ok: true, value: join(root, 'ideas', 'Plan.excalidraw') });
    expect(existsSync(join(root, 'Plan.excalidraw'))).toBe(false);
    expect(readFileSync(join(root, 'ideas', 'Plan.excalidraw'), 'utf8')).toBe('mine');
  });

  it('never overwrites a board already there', async () => {
    const root = folder();
    writeFileSync(join(root, 'ideas', 'Plan.excalidraw'), 'theirs');
    const result = await moveEntry(join(root, 'Plan.excalidraw'), join(root, 'ideas'));
    expect(result.ok).toBe(false);
    expect(readFileSync(join(root, 'ideas', 'Plan.excalidraw'), 'utf8')).toBe('theirs');
    expect(readFileSync(join(root, 'Plan.excalidraw'), 'utf8')).toBe('mine');
  });

  it('moves folders with what is inside, but never into themselves', async () => {
    const root = folder();
    mkdirSync(join(root, 'reels'));
    writeFileSync(join(root, 'reels', 'Hooks.excalidraw'), 'x');
    expect((await moveEntry(join(root, 'reels'), join(root, 'ideas'))).ok).toBe(true);
    expect(existsSync(join(root, 'ideas', 'reels', 'Hooks.excalidraw'))).toBe(true);
    expect((await moveEntry(join(root, 'ideas'), join(root, 'ideas', 'reels'))).ok).toBe(false);
  });
});
