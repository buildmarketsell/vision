import { createElement } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { CalendarView } from './renderer/CalendarView';

export const calendarFeature: Feature = {
  id: 'calendar',
  name: 'Calendar',
  sidebarViews: [{ id: 'calendar', title: 'Calendar', icon: createElement(CalendarDays, { size: 15, strokeWidth: 1.5 }), component: CalendarView }],
};
