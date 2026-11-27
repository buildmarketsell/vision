import { create } from 'zustand';

/** The animation beside the Claude chat (Dan, 2026-11-27, after Magic UI's Dither, Dot Pattern and Animated Grid Pattern). */
export type ChatBackdrop = 'off' | 'dither' | 'dots' | 'grid';

export const CHAT_BACKDROPS: { value: ChatBackdrop; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'dither', label: 'Dither' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
];

const STORAGE_KEY = 'vision.chatBackdrop';
const DEFAULT: ChatBackdrop = 'dither';

function readStored(): ChatBackdrop {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return CHAT_BACKDROPS.find((option) => option.value === stored)?.value ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

interface ChatBackdropState {
  backdrop: ChatBackdrop;
  setBackdrop: (backdrop: ChatBackdrop) => void;
}

/** Picked in Settings, used by every Claude chat, remembered across launches. */
export const useChatBackdrop = create<ChatBackdropState>((set) => ({
  backdrop: readStored(),
  setBackdrop: (backdrop) => {
    set({ backdrop });
    try {
      localStorage.setItem(STORAGE_KEY, backdrop);
    } catch {
      // Not remembering it is fine; it still switches.
    }
  },
}));
