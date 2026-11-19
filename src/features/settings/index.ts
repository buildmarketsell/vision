import { createElement } from 'react';
import { Settings } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { SettingsPage } from './renderer/SettingsView';

/** Settings, pinned to the bottom of the menu. */
export const settingsFeature: Feature = {
  id: 'settings',
  name: 'Settings',
  sidebarViews: [{ id: 'settings', title: 'Settings', icon: createElement(Settings, { size: 16, strokeWidth: 1.5 }), main: SettingsPage, pinBottom: true }],
};
