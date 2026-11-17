import type { VisionApi } from '../shared/ipc';

declare global {
  interface Window {
    vision: VisionApi;
    /** Where Excalidraw loads its fonts from (set by the board feature to the bundled copy). */
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

export {};
