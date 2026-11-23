import { useEffect, useState } from 'react';
import type { CalendarEvent, CalendarState } from '../../../shared/calendar';
import { useNow } from '../../../renderer/core/useNow';
import { soonLabel, timeRange } from './agenda';

const REFRESH_MS = 5 * 60_000;

/** Dashboard card: what's left of today on the calendar. */
export function TodayCard() {
  const [state, setState] = useState<CalendarState | null>(null);
  const now = useNow();
  useEffect(() => {
    const load = () => void window.vision.calendar.state().then(setState, () => setState(null));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  if (!state) return <div className="caption">Loading…</div>;
  if (state.kind === 'setup') return <div className="caption">Connect Google Calendar in the Calendar view to see your day here.</div>;
  const endOfDay = new Date(now).setHours(23, 59, 59, 999);
  const today = state.events.filter((event: CalendarEvent) => event.end > now && event.start <= endOfDay && !event.free).sort((a, b) => a.start - b.start);
  if (today.length === 0) return <div className="caption">Nothing else today.</div>;
  return (
    <div>
      {today.map((event) => (
        <div key={event.id} className="dash-row">
          <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: event.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{event.title}</span>
          <span className="caption shrink-0">{soonLabel(event, now) ?? timeRange(event)}</span>
        </div>
      ))}
    </div>
  );
}
