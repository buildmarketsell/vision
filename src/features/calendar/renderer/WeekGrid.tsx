import { useEffect, useRef, type MouseEvent } from 'react';
import type { CalendarEvent } from '../../../shared/calendar';
import { useNow } from '../../../renderer/core/useNow';
import { timeRange } from './agenda';
import { allDayOn, layoutDay, startOfDay } from './weekLayout';

/** Pixels per hour; must match `--hour` in calendar-page.css. */
export const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SNAP_MINUTES = 30;

export interface SlotPick {
  dayStart: number;
  /** Minutes from midnight, snapped to the half hour. */
  minutes: number;
  x: number;
  y: number;
}

function hourLabel(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function DayHeader({ day, today }: { day: number; today: boolean }) {
  const date = new Date(day);
  return (
    <div className="week-day-head" data-today={today}>
      <span className="week-weekday">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span className="week-date">{date.getDate()}</span>
    </div>
  );
}

function DayColumn({ day, events, now, onPick }: { day: number; events: CalendarEvent[]; now: number; onPick: (pick: SlotPick) => void }) {
  const today = startOfDay(now) === day;
  const pick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minutes = Math.min(23 * 60 + 30, Math.floor((offset / HOUR_PX) * (60 / SNAP_MINUTES)) * SNAP_MINUTES);
    onPick({ dayStart: day, minutes, x: event.clientX, y: event.clientY });
  };
  return (
    <div className="week-column" data-today={today} onClick={pick} aria-label={new Date(day).toDateString()}>
      {layoutDay(events, day).map(({ event, top, height, column, columns }) => (
        <div
          key={event.id}
          className="week-event"
          data-short={height < 40}
          style={{
            top: (top / 60) * HOUR_PX,
            height: (height / 60) * HOUR_PX - 2,
            left: `calc(${(column / columns) * 100}% + 2px)`,
            width: `calc(${100 / columns}% - 4px)`,
            ['--event-color' as string]: event.color,
          }}
          title={`${event.title}\n${timeRange(event)}${event.location ? `\n${event.location}` : ''}`}
        >
          <span className="week-event-title">{event.title}</span>
          <span className="week-event-time">{timeRange(event)}</span>
        </div>
      ))}
      {today && <div className="week-now" style={{ top: ((now - day) / 3_600_000) * HOUR_PX }} aria-hidden />}
    </div>
  );
}

/** Notion Calendar's week: day headers, an all-day row, then 24 hours with events as colored blocks. */
export function WeekGrid({ days, events, onPick }: { days: number[]; events: CalendarEvent[]; onPick: (pick: SlotPick) => void }) {
  const now = useNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstDay = days[0];

  // Open at the working day (an hour before now, or 8:00), not at midnight.
  useEffect(() => {
    const hour = new Date().getHours();
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (hour >= 8 && hour < 20 ? hour - 1 : 8) * HOUR_PX);
  }, [firstDay]);

  const today = startOfDay(now);
  const allDay = days.map((day) => allDayOn(events, day));
  return (
    <div className="week">
      <div className="week-head">
        <div className="week-gutter" />
        {days.map((day) => (
          <DayHeader key={day} day={day} today={day === today} />
        ))}
      </div>
      {allDay.some((list) => list.length > 0) && (
        <div className="week-allday">
          <div className="week-gutter week-allday-label">All day</div>
          {allDay.map((list, index) => (
            <div key={days[index]} className="week-allday-cell">
              {list.map((event) => (
                <div key={event.id} className="week-chip" style={{ ['--event-color' as string]: event.color }} title={event.title}>
                  {event.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="week-scroll">
        <div className="week-body">
          <div className="week-gutter">
            {HOURS.map((hour) => (
              <div key={hour} className="week-hour-label">{hour === 0 ? '' : hourLabel(hour)}</div>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn key={day} day={day} events={events} now={now} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}
