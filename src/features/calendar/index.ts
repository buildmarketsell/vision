import { createElement } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { CalendarPage } from './renderer/CalendarPage';
import { CALENDAR_TAB } from './renderer/calendarTab';
import { CalendarView } from './renderer/CalendarView';
import { TodayCard } from './renderer/TodayCard';

const icon = () => createElement(CalendarDays, { size: 15, strokeWidth: 1.5 });

export const calendarFeature: Feature = {
  id: 'calendar',
  name: 'Calendar',
  sidebarViews: [{ id: 'calendar', title: 'Calendar', icon: icon(), component: CalendarView, main: CalendarPage }],
  // The quick "what's next" list also sits in the Workspace panel (Dan, 2026-11-19).
  workspaceTabs: [{ id: 'calendar', title: 'Calendar', icon: icon(), component: CalendarView }],
  dashboardCards: [{ id: 'today', title: 'Today', icon: icon(), component: TodayCard, view: 'calendar' }],
  tabTypes: [{ id: CALENDAR_TAB, component: CalendarPage, closable: true, icon }],
};
