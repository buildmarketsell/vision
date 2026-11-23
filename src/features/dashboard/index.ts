import { createElement } from 'react';
import { LayoutDashboard } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { DashboardPage } from './renderer/DashboardPage';

/** Dashboard (Dan, 2026-11-23: "the most important things that i can choose"): each feature adds its own card (`dashboardCards`). */
export const dashboardFeature: Feature = {
  id: 'dashboard',
  name: 'Dashboard',
  sidebarViews: [{ id: 'dashboard', title: 'Dashboard', icon: createElement(LayoutDashboard, { size: 16, strokeWidth: 1.5 }), main: DashboardPage }],
};
