import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDocumentStore, type DocumentStoreOptions } from '../../src/main/documentStore';

interface Doc {
  count: number;
}

const read = (raw: unknown): Doc => ({ count: typeof (raw as Doc | undefined)?.count === 'number' ? (raw as Doc).count : 0 });

let folder: string;
let path: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'vision-doc-'));
  path = join(folder, 'doc.json');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const store = (extra: Partial<DocumentStoreOptions<Doc>> = {}) => createDocumentStore<Doc>({ path: () => path, read, ...extra });
const onDisk = async () => JSON.parse(await readFile(path, 'utf8')) as unknown;

describe('document store', () => {
  it('starts from read(undefined) when there is no file yet', () => {
    expect(store().get()).toEqual({ count: 0 });
  });

  it('saves so a fresh store reads the same value back', async () => {
    await store().set({ count: 3 });
    expect(store().get()).toEqual({ count: 3 });
  });

  it('shows the new value at once, before the write finishes', async () => {
    const doc = store();
    const saving = doc.set({ count: 5 });
    expect(doc.get()).toEqual({ count: 5 });
    await saving;
  });

  it('writes the file readable only by its owner', async () => {
    await store().set({ count: 1 });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('saves what write() returns, not the value itself', async () => {
    await store({ write: (doc) => ({ count: doc.count * 10 }) }).set({ count: 2 });
    expect(await onDisk()).toEqual({ count: 20 });
  });

  it('moves a damaged file aside instead of losing it on the next save', async () => {
    await writeFile(path, '{ not json', 'utf8');
    const doc = store();
    expect(doc.get()).toEqual({ count: 0 });
    await doc.set({ count: 1 });
    const kept = (await readdir(folder)).filter((name) => name.startsWith('doc.json.damaged-'));
    expect(kept).toHaveLength(1);
    expect(await readFile(join(folder, kept[0] ?? ''), 'utf8')).toBe('{ not json');
  });

  it('keeps the last of several quick saves on disk', async () => {
    const doc = store();
    const saves = [1, 2, 3, 4, 5].map((count) => doc.set({ count }));
    await Promise.all(saves);
    expect(await onDisk()).toEqual({ count: 5 });
  });

  it('keeps saving after one save failed', async () => {
    let fail = true;
    const doc = store({ write: (value) => {
      if (fail) throw new Error('Keychain unavailable');
      return value;
    } });
    await expect(doc.set({ count: 1 })).rejects.toThrow('Keychain unavailable');
    fail = false;
    await doc.set({ count: 2 });
    expect(await onDisk()).toEqual({ count: 2 });
  });

  it('keeps the old value when write() refuses the new one', async () => {
    const doc = store({ write: () => {
      throw new Error('Keychain unavailable');
    } });
    await expect(doc.set({ count: 9 })).rejects.toThrow();
    expect(doc.get()).toEqual({ count: 0 });
  });

  it('the same store keeps saving after the disk refused a write', async () => {
    let target = join(folder, 'missing', 'doc.json');
    const doc = createDocumentStore<Doc>({ path: () => target, read });
    await expect(doc.set({ count: 1 })).rejects.toThrow();
    target = path;
    await doc.set({ count: 2 });
    expect(await onDisk()).toEqual({ count: 2 });
  });

  it('flush retries a save that failed', async () => {
    let target = join(folder, 'missing', 'doc.json');
    const doc = createDocumentStore<Doc>({ path: () => target, read });
    await expect(doc.set({ count: 4 })).rejects.toThrow();
    target = path;
    await doc.flush();
    expect(await onDisk()).toEqual({ count: 4 });
  });

  it('flush never puts back an older failed save over a newer one', async () => {
    let target = join(folder, 'missing', 'doc.json');
    const doc = createDocumentStore<Doc>({ path: () => target, read });
    const failing = doc.set({ count: 1 });
    target = path;
    await doc.set({ count: 2 });
    await failing.catch(() => undefined);
    await doc.flush();
    expect(await onDisk()).toEqual({ count: 2 });
  });

  it('saves the value as it was when set, even if it is changed in place afterwards', async () => {
    const doc = store();
    const value = { count: 1 };
    const saving = doc.set(value);
    value.count = 99;
    await saving;
    expect(await onDisk()).toEqual({ count: 1 });
  });

  it('still saves when a listener throws', async () => {
    const doc = store();
    doc.onChange(() => {
      throw new Error('window closed');
    });
    let saving: Promise<void> | undefined;
    expect(() => {
      saving = doc.set({ count: 3 });
    }).toThrow('window closed');
    await doc.flush();
    await saving?.catch(() => undefined);
    expect(await onDisk()).toEqual({ count: 3 });
  });

  it('moves aside a file it cannot open, rather than overwriting it', async () => {
    await mkdir(path);
    await writeFile(join(path, 'inside.txt'), 'keep me', 'utf8');
    const doc = store();
    expect(doc.get()).toEqual({ count: 0 });
    await doc.set({ count: 1 });
    const kept = (await readdir(folder)).filter((name) => name.startsWith('doc.json.damaged-'));
    expect(kept).toHaveLength(1);
    expect(await readFile(join(folder, kept[0] ?? '', 'inside.txt'), 'utf8')).toBe('keep me');
  });

  it('tells listeners about every change', async () => {
    const doc = store();
    const seen: number[] = [];
    doc.onChange((value) => seen.push(value.count));
    await doc.set({ count: 1 });
    await doc.set({ count: 2 });
    expect(seen).toEqual([1, 2]);
  });

  it('with a save delay, turns quick changes into one write', async () => {
    const doc = store({ saveDelayMs: 20 });
    const saves = [doc.set({ count: 1 }), doc.set({ count: 2 }), doc.set({ count: 3 })];
    await expect(stat(path)).rejects.toThrow();
    await Promise.all(saves);
    expect(await onDisk()).toEqual({ count: 3 });
  });

  it('flush writes a delayed change right away', async () => {
    const doc = store({ saveDelayMs: 60_000 });
    void doc.set({ count: 7 });
    await doc.flush();
    expect(await onDisk()).toEqual({ count: 7 });
  });
});
