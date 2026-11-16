import type { VisionApi } from '../shared/ipc';

declare global {
  interface Window {
    vision: VisionApi;
  }
}

export {};
