import { openPageTab } from '../../../renderer/core/dockActions';

export const CALENDAR_TAB = 'calendar';
const CALENDAR_PANEL_ID = 'calendar:page';

/** Opens the calendar page (week view) where files open, or brings it forward. */
export function openCalendarPage(): void {
  openPageTab(CALENDAR_PANEL_ID, CALENDAR_TAB, 'Calendar');
}
