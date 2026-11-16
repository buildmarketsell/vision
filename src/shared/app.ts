export const APP_NAME = 'VISION';

/** Folders the file tree and watcher never descend into. */
export const DEFAULT_IGNORED_NAMES = ['node_modules', '.git', 'dist', 'build', 'out', '.venv', '.DS_Store'];

/** Files larger than this open with a message instead of in the editor. */
export const MAX_EDITABLE_FILE_BYTES = 5 * 1024 * 1024;

/** How many bytes are checked for a NUL byte to decide a file is binary. */
export const BINARY_SNIFF_BYTES = 8000;

export const MAX_RECENT_FOLDERS = 20;
