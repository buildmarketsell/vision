import { createElement } from 'react';
import { Timer } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { FocusCard } from './renderer/FocusCard';
import { startFocus, useFocusStore } from '../../renderer/core/focus';
import { DEFAULT_FOCUS_MINUTES } from '../../shared/focus';

/** Focus has no page of its own: it lives in the menu bar, the island, the to-do rows and these ⌘K commands. */
export const focusFeature: Feature = {
  id: 'focus',
  name: 'Focus',
  dashboardCards: [{ id: 'focus', title: 'Focus', icon: createElement(Timer, { size: 14, strokeWidth: 1.75 }), component: FocusCard }],
  commands: [
    { id: 'focus.start', title: `Start focus (${DEFAULT_FOCUS_MINUTES} min)`, run: () => void startFocus(null, DEFAULT_FOCUS_MINUTES) },
    { id: 'focus.stopwatch', title: 'Start stopwatch', run: () => void startFocus(null, null) },
    {
      id: 'focus.pause',
      title: 'Pause or resume focus',
      run: async () => {
        const view = useFocusStore.getState().view ?? (await window.vision.focus.view());
        await window.vision.focus.act({ kind: view.state.focus?.runningSince === null ? 'resume' : 'pause' });
      },
    },
    { id: 'focus.stop', title: 'Stop focus', run: () => void window.vision.focus.act({ kind: 'stop' }) },
  ],
};
