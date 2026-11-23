import { readFileSync, renameSync } from 'node:fs';
import { chmod, rename, writeFile } from 'node:fs/promises';

export interface DocumentStoreOptions<T> {
  /** Where the file lives (usually in userData). Read on every load and save. */
  path: () => string;
  /** Turns whatever is on disk (any JSON, or undefined when there is no file yet) into a valid value. */
  read: (raw: unknown) => T;
  /** What to save for a value (e.g. with secrets encrypted). May throw to refuse it; the old value then stays. */
  write?: (value: T) => unknown;
  /** Waits this long after a change before writing, so quick changes become one write. */
  saveDelayMs?: number;
}

export interface DocumentStore<T> {
  /** The value, read from disk the first time. */
  get(): T;
  /** Takes the new value at once and saves it. Resolves when it is on disk; rejects if write() refused it or the disk failed. */
  set(next: T): Promise<void>;
  /** Called after every set(). */
  onChange(listener: (value: T) => void): void;
  /** Writes a delayed change now and waits for every write under way. Call before quitting. */
  flush(): Promise<void>;
}

interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * One JSON file in userData, kept in memory after the first read.
 * Saves go through a temp file (a crash never leaves half a file), one at a time, readable only by Dan's user.
 * A file that exists but can't be read is moved aside (`<name>.damaged-<time>`), never overwritten by the next save.
 */
export function createDocumentStore<T>({ path, read, write = (value) => value, saveDelayMs = 0 }: DocumentStoreOptions<T>): DocumentStore<T> {
  let loaded: { value: T } | null = null;
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { text: string; waiters: Waiter[] } | null = null;
  const listeners: Array<(value: T) => void> = [];

  // Set when a file exists but could not be read nor moved aside: saving then would destroy it.
  let blocked: Error | null = null;

  const moveAside = (): void => {
    try {
      renameSync(path(), `${path()}.damaged-${Date.now()}`);
    } catch (error) {
      blocked = new Error(`${path()} could not be read or moved aside, so it is not overwritten`, { cause: error });
    }
  };

  const load = (): T => {
    let text: string;
    try {
      text = readFileSync(path(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') moveAside();
      return read(undefined);
    }
    try {
      return read(JSON.parse(text));
    } catch {
      moveAside();
      return read(undefined);
    }
  };

  const get = (): T => {
    loaded ??= { value: load() };
    return loaded.value;
  };

  // The newest save, if it failed, so flush() (at quit) tries it again. An older failure never replaces newer text.
  let failed: string | null = null;
  let newest = 0;

  // Each write waits for the one before, and a failed write never blocks the ones after it.
  const writeNow = (text: string): Promise<void> => {
    const target = path();
    const temp = `${target}.tmp`;
    const run = queue.then(async () => {
      if (blocked) throw blocked;
      await writeFile(temp, text, { encoding: 'utf8', mode: 0o600 });
      await chmod(temp, 0o600);
      await rename(temp, target);
    });
    const turn = ++newest;
    failed = null;
    queue = run.catch(() => {
      if (turn === newest) failed = text;
    });
    return run;
  };

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return failed === null ? queue : writeNow(failed);
    const { text, waiters } = pending;
    pending = null;
    const run = writeNow(text);
    run.then(
      () => waiters.forEach((waiter) => waiter.resolve()),
      (error: unknown) => waiters.forEach((waiter) => waiter.reject(error)),
    );
    return run;
  };

  const set = (next: T): Promise<void> => {
    let text: string;
    try {
      // Turned into text now, so later in-place changes to `next` are never saved by accident.
      text = JSON.stringify(write(next), null, 2);
    } catch (error) {
      return Promise.reject(error);
    }
    loaded = { value: next };
    let saving: Promise<void>;
    if (saveDelayMs <= 0) {
      saving = writeNow(text);
    } else {
      saving = new Promise((resolve, reject) => {
        pending = { text, waiters: [...(pending?.waiters ?? []), { resolve, reject }] };
      });
      if (timer) clearTimeout(timer);
      // Errors reach the callers through their own promises.
      timer = setTimeout(() => void flush().catch(() => undefined), saveDelayMs);
    }
    // Listeners run after the save is on its way, so one that throws can't stop it.
    for (const listener of listeners) listener(next);
    return saving;
  };

  return { get, set, onChange: (listener) => listeners.push(listener), flush };
}
