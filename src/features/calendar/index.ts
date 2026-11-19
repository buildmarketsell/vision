import { createElement } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { CalendarPage } from './renderer/CalendarPage';
import { CALENDAR_TAB } from './renderer/calendarTab';
import { CalendarView } from './renderer/CalendarView';

const icon = () => createElement(CalendarDays, { size: 15, strokeWidth: 1.5 });

export const calendarFeature: Feature = {
  id: 'calendar',
  name: 'Calendar',
  sidebarViews: [{ id: 'calendar', title: 'Calendar', icon: icon(), component: CalendarView, main: CalendarPage }],
  tabTypes: [{ id: CALENDAR_TAB, component: CalendarPage, closable: true, icon }],
};
