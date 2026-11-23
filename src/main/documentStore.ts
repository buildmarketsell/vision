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
 * A file that can't be read is moved aside (`<name>.damaged-<time>`) instead of being overwritten by the next save.
 */
export function createDocumentStore<T>({ path, read, write = (value) => value, saveDelayMs = 0 }: DocumentStoreOptions<T>): DocumentStore<T> {
  let loaded: { value: T } | null = null;
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { data: unknown; waiters: Waiter[] } | null = null;
  const listeners: Array<(value: T) => void> = [];

  const load = (): T => {
    let text: string;
    try {
      text = readFileSync(path(), 'utf8');
    } catch {
      return read(undefined);
    }
    try {
      return read(JSON.parse(text));
    } catch {
      try {
        renameSync(path(), `${path()}.damaged-${Date.now()}`);
      } catch {
        // Could not move it: the next save replaces it, as before this store existed.
      }
      return read(undefined);
    }
  };

  const get = (): T => {
    loaded ??= { value: load() };
    return loaded.value;
  };

  // Each write waits for the one before, and a failed write never blocks the ones after it.
  const writeNow = (data: unknown): Promise<void> => {
    const target = path();
    const temp = `${target}.tmp`;
    const run = queue.then(async () => {
      await writeFile(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
      await chmod(temp, 0o600);
      await rename(temp, target);
    });
    queue = run.catch(() => undefined);
    return run;
  };

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return queue;
    const { data, waiters } = pending;
    pending = null;
    const run = writeNow(data);
    run.then(
      () => waiters.forEach((waiter) => waiter.resolve()),
      (error: unknown) => waiters.forEach((waiter) => waiter.reject(error)),
    );
    return run;
  };

  const set = (next: T): Promise<void> => {
    let data: unknown;
    try {
      data = write(next);
    } catch (error) {
      return Promise.reject(error);
    }
    loaded = { value: next };
    for (const listener of listeners) listener(next);
    if (saveDelayMs <= 0) return writeNow(data);
    return new Promise((resolve, reject) => {
      pending = { data, waiters: [...(pending?.waiters ?? []), { resolve, reject }] };
      if (timer) clearTimeout(timer);
      // Errors reach the callers through their own promises.
      timer = setTimeout(() => void flush().catch(() => undefined), saveDelayMs);
    });
  };

  return { get, set, onChange: (listener) => listeners.push(listener), flush };
}
