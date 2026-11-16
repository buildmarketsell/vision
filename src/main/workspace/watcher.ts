import { watch, type FSWatcher } from 'chokidar';
import { basename } from 'node:path';
import { DEFAULT_IGNORED_NAMES } from '../../shared/app';
import type { FsChangeEvent } from '../../shared/ipc';

const ignoredNames = new Set(DEFAULT_IGNORED_NAMES);
const WATCHED_KINDS = new Set<FsChangeEvent['kind']>(['add', 'addDir', 'change', 'unlink', 'unlinkDir']);

/**
 * Watches only what the window needs (expanded folders, one level deep, plus open files),
 * so even huge folders stay cheap.
 */
export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private watched = new Set<string>();

  constructor(private readonly onChange: (event: FsChangeEvent) => void) {}

  private ensureWatcher(): FSWatcher {
    if (this.watcher) return this.watcher;
    this.watcher = watch([], {
      ignoreInitial: true,
      depth: 0,
      ignored: (path: string) => ignoredNames.has(basename(path)),
    });
    this.watcher.on('all', (kind, path) => {
      if (WATCHED_KINDS.has(kind as FsChangeEvent['kind'])) this.onChange({ kind: kind as FsChangeEvent['kind'], path });
    });
    return this.watcher;
  }

  /** Makes the watched set exactly `paths`. */
  sync(paths: string[]): void {
    const next = new Set(paths);
    const added = [...next].filter((path) => !this.watched.has(path));
    const removed = [...this.watched].filter((path) => !next.has(path));
    this.watched = next;
    if (added.length > 0) this.ensureWatcher().add(added);
    if (removed.length > 0) void this.watcher?.unwatch(removed);
  }

  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
    this.watched.clear();
  }
}
