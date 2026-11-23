import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Circle } from 'lucide-react';
import type { CalendarEvent } from '../../../shared/calendar';
import type { PlanBlock } from '../../../shared/plan';
import { useNow } from '../../../renderer/core/useNow';
import { timeRange } from './agenda';
import { allDayOn, clickRange, clockTime, DRAG_SNAP_MINUTES, dragRange, eventBox, layoutDay, minutesAt, startOfDay } from './weekLayout';

/** Pixels per hour; must match `--hour` in calendar-page.css. */
export const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Moving less than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

/** A stretch of one day, in minutes from midnight. */
export interface TimeSlot {
  dayStart: number;
  start: number;
  end: number;
}

/** Planned blocks: accent for work, green for personal; outlined with a circle so they read apart from Google's events. */
const BLOCK_COLOR = { work: 'var(--color-accent)', personal: 'var(--color-success)' };
const PLAN_ID = 'plan|';

/** Blocks as events, so they share the overlap layout with meetings. */
const blockId = (block: PlanBlock) => `${PLAN_ID}${block.taskId}|${block.start}`;
function blockEvents(blocks: PlanBlock[]): CalendarEvent[] {
  return blocks.map((block) => ({
    id: blockId(block),
    calendarKey: '',
    title: block.title,
    location: null,
    allDay: false,
    start: block.start,
    end: block.end,
    color: BLOCK_COLOR[block.hours],
    taskId: block.taskId,
  }));
}

export type BlockPick = { block: PlanBlock; x: number; y: number };

/** A slot picked with the pointer, and where it was let go (to place the new-event popover). */
export interface SlotPick extends TimeSlot {
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

/** The shaded block for the time being picked (while dragging, and while the new-event popover is open). */
function Selection({ slot }: { slot: { start: number; end: number } }) {
  return (
    <div className="week-selection" style={{ top: (slot.start / 60) * HOUR_PX, height: ((slot.end - slot.start) / 60) * HOUR_PX - 2 }} aria-hidden>
      {clockTime(slot.start)} – {clockTime(slot.end)}
    </div>
  );
}

function DayColumn({ day, events, blocks, now, pending, onPick, onBlock }: {
  day: number;
  events: CalendarEvent[];
  blocks: Map<string, PlanBlock>;
  now: number;
  pending: TimeSlot | null;
  onPick: (pick: SlotPick) => void;
  onBlock: (pick: BlockPick) => void;
}) {
  const today = startOfDay(now) === day;
  const [dragging, setDragging] = useState<{ start: number; end: number } | null>(null);

  // Press on empty space, drag up or down to pick a stretch (quarter hours); a plain click picks an hour.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const column = event.currentTarget;
    const offset = (clientY: number) => clientY - column.getBoundingClientRect().top;
    const startY = event.clientY;
    const anchor = minutesAt(offset(startY), HOUR_PX, DRAG_SNAP_MINUTES);
    let moved = false;
    let range = dragRange(anchor, anchor);
    column.setPointerCapture(event.pointerId);
    const onMove = (move: globalThis.PointerEvent) => {
      if (!moved && Math.abs(move.clientY - startY) < DRAG_THRESHOLD_PX) return;
      moved = true;
      range = dragRange(anchor, minutesAt(offset(move.clientY), HOUR_PX, DRAG_SNAP_MINUTES));
      setDragging(range);
    };
    const onUp = (up: globalThis.PointerEvent) => {
      column.removeEventListener('pointermove', onMove);
      column.removeEventListener('pointerup', onUp);
      column.removeEventListener('pointercancel', onUp);
      setDragging(null);
      if (up.type === 'pointercancel') return;
      const picked = moved ? range : clickRange(offset(startY), HOUR_PX);
      onPick({ dayStart: day, ...picked, x: up.clientX, y: up.clientY });
    };
    column.addEventListener('pointermove', onMove);
    column.addEventListener('pointerup', onUp);
    column.addEventListener('pointercancel', onUp);
  };

  const shown = dragging ?? (pending?.dayStart === day ? pending : null);
  return (
    <div className="week-column" data-today={today} onPointerDown={onPointerDown} aria-label={new Date(day).toDateString()}>
      {layoutDay(events, day).map(({ event, top, height, column, columns }) => {
        const box = eventBox(height, HOUR_PX);
        const style = {
          top: (top / 60) * HOUR_PX,
          height: box.height,
          left: `calc(${(column / columns) * 100}% + 2px)`,
          width: `calc(${100 / columns}% - 4px)`,
          ['--event-color' as string]: event.color,
        };
        const block = blocks.get(event.id);
        if (block) {
          return (
            <button key={event.id} className="week-event" data-planned data-past={block.end <= now} data-short={box.compact} style={style} aria-label={`Planned: ${event.title}, ${timeRange(event)}`} onClick={(click) => onBlock({ block, x: click.clientX, y: click.clientY })}>
              <span className="week-event-title"><Circle size={10} strokeWidth={2.25} aria-hidden /> {event.title}</span>
              <span className="week-event-time">{timeRange(event)}</span>
            </button>
          );
        }
        return (
          <div key={event.id} className="week-event" data-short={box.compact} data-past-plan={event.taskId !== undefined} style={style} title={`${event.title}\n${timeRange(event)}${event.location ? `\n${event.location}` : ''}`}>
            <span className="week-event-title">{event.title}</span>
            <span className="week-event-time">{timeRange(event)}</span>
          </div>
        );
      })}
      {shown && <Selection slot={shown} />}
      {today && <div className="week-now" style={{ top: ((now - day) / 3_600_000) * HOUR_PX }} aria-hidden />}
    </div>
  );
}

/** Notion Calendar's week: day headers, an all-day row, then 24 hours with events as colored blocks. */
export function WeekGrid({ days, events, blocks, pending, onPick, onBlock }: {
  days: number[];
  events: CalendarEvent[];
  /** Time VISION planned for to-dos. */
  blocks: PlanBlock[];
  onBlock: (pick: BlockPick) => void;
  /** The slot the new-event popover is for, kept shaded until it closes. */
  pending: TimeSlot | null;
  onPick: (pick: SlotPick) => void;
}) {
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
  const planned = blockEvents(blocks);
  const blockById = new Map(blocks.map((block) => [blockId(block), block]));
  const timed = [...events, ...planned];
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
            <DayColumn key={day} day={day} events={timed} blocks={blockById} now={now} pending={pending} onPick={onPick} onBlock={onBlock} />
          ))}
        </div>
      </div>
    </div>
  );
}
