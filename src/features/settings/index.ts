import { createElement } from 'react';
import { Settings } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { SettingsView } from './renderer/SettingsView';

/** The gear after the Inbox: settings, and the home for Dan's other app features. */
export const settingsFeature: Feature = {
  id: 'settings',
  name: 'Settings',
  sidebarViews: [{ id: 'settings', title: 'Settings', icon: createElement(Settings, { size: 16, strokeWidth: 1.5 }), component: SettingsView }],
};
