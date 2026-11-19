import { create } from 'zustand';

/** Bumped whenever the Calendar panel's state changes (sign-in, sign-out, shown calendars, new event), so the week page reloads. */
export const useCalendarVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));
