import type { CalendarEvent } from '../shared/calendar';
import type { PlanBlock } from '../shared/plan';

/**
 * The Calendar feature's events and planned blocks, for the focus timer (meeting heads-up, a check-in's Not yet).
 * The Calendar fills it in when it starts; other features read it here and never import the Calendar feature.
 */
let eventsSource: () => Promise<CalendarEvent[]> = () => Promise.resolve([]);
let blocksSource: () => PlanBlock[] = () => [];
const changeListeners: Array<() => void> = [];

export const calendarBridge = {
  provideEvents(source: () => Promise<CalendarEvent[]>): void {
    eventsSource = source;
  },
  providePlanBlocks(source: () => PlanBlock[]): void {
    blocksSource = source;
  },
  /** The Calendar calls this when Dan changes it in VISION (signs in, shows a calendar, adds an event). */
  eventsChanged(): void {
    for (const listener of changeListeners) listener();
  },
  onEventsChanged(listener: () => void): void {
    changeListeners.push(listener);
  },
  /** The visible calendars' events from yesterday to two weeks ahead (cached a few minutes); empty without a Google account. */
  events: (): Promise<CalendarEvent[]> => eventsSource(),
  /** Every block of the latest plan, past and coming. */
  planBlocks: (): PlanBlock[] => blocksSource(),
};
