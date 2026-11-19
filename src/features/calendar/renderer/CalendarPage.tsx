import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Plus, RotateCw } from 'lucide-react';
import type { CalendarState, NewEventInput } from '../../../shared/calendar';
import { NewEventForm } from './NewEventForm';
import { WeekGrid, type SlotPick } from './WeekGrid';
import { addDays, DAYS_IN_WEEK, startOfWeek, weekDays, weekTitle } from './weekLayout';
import './calendar.css';
import './calendar-page.css';

const REFRESH_MS = 5 * 60_000;
const POPOVER = { width: 320, height: 440 };

/** One week of events. `loading` is true until the week on screen is the one asked for. */
function useWeek(weekStart: number) {
  const [result, setResult] = useState<{
    weekStart: number;
    state: CalendarState;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = (week: number, force: boolean) => {
    window.vision.calendar.range(week, addDays(week, DAYS_IN_WEEK), force).then(
      (state) => {
        setFailed(false);
        setResult({ weekStart: week, state });
      },
      () => setFailed(true),
    );
  };
  useEffect(() => {
    load(weekStart, false);
    const timer = setInterval(() => load(weekStart, false), REFRESH_MS);
    return () => clearInterval(timer);
  }, [weekStart]);
  return {
    state: result?.state ?? null,
    loading: result?.weekStart !== weekStart,
    failed,
    reload: () => load(weekStart, true),
  };
}

type Draft = { initial: Partial<NewEventInput>; left: number; top: number };

const pad = (value: number) => String(value).padStart(2, '0');

function draftFromPick(pick: SlotPick): Draft {
  const date = new Date(pick.dayStart);
  const end = Math.min(pick.minutes + 60, 23 * 60 + 59);
  return {
    initial: {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      startTime: `${pad(Math.floor(pick.minutes / 60))}:${pad(pick.minutes % 60)}`,
      endTime: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
    },
    left: Math.max(8, Math.min(pick.x + 8, window.innerWidth - POPOVER.width - 8)),
    top: Math.max(8, Math.min(pick.y - 40, window.innerHeight - POPOVER.height - 8)),
  };
}

/** The calendar as a page, like Notion Calendar: a week at a time, click an empty slot to add an event. */
export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(Date.now()));
  const { state, loading, failed, reload } = useWeek(weekStart);
  const [draft, setDraft] = useState<Draft | null>(null);
  const ready = state?.kind === 'ready' ? state : null;
  const canAdd = ready?.calendars.some((calendar) => calendar.writable) ?? false;

  const openNew = () =>
    setDraft({
      initial: {},
      left: Math.max(8, window.innerWidth - POPOVER.width - 24),
      top: 64,
    });

  return (
    <div className="calendar-page">
      <header className="calendar-page-head">
        <h1 className="calendar-page-title">{weekTitle(weekStart)}</h1>
        {loading && <div className="spinner" aria-label="Loading week" />}
        <span className="flex-1" />
        <button className="button-secondary" onClick={() => setWeekStart(startOfWeek(Date.now()))}>
          Today
        </button>
        <button className="icon-button" title="Previous week" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -DAYS_IN_WEEK))}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button className="icon-button" title="Next week" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, DAYS_IN_WEEK))}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <button className="icon-button" title="Refresh" aria-label="Refresh calendar" onClick={reload}>
          <RotateCw size={14} strokeWidth={1.5} />
        </button>
        {canAdd && (
          <button className="button-primary" onClick={openNew}>
            <Plus size={14} strokeWidth={2} /> New event
          </button>
        )}
      </header>
      {failed && (
        <div className="calendar-error px-6 pb-2" role="alert">
          The calendar could not be read. Check your internet and press refresh.
        </div>
      )}
      {ready?.error && (
        <div className="calendar-error px-6 pb-2" role="alert">
          {ready.error}
        </div>
      )}
      {state?.kind === 'setup' && <p className="calendar-empty px-6">Connect Google Calendar in the Calendar view of the sidebar first.</p>}
      <WeekGrid days={weekDays(weekStart)} events={ready?.events ?? []} onPick={(pick) => canAdd && setDraft(draftFromPick(pick))} />
      {draft &&
        ready &&
        // On the body: the dock's panes clip anything fixed-positioned inside them.
        createPortal(
          <>
            <div className="calendar-scrim" onClick={() => setDraft(null)} aria-hidden />
            <div className="calendar-popover" style={{ left: draft.left, top: draft.top, width: POPOVER.width }}>
              <NewEventForm
                calendars={ready.calendars}
                initial={draft.initial}
                onCancel={() => setDraft(null)}
                onSaved={() => {
                  setDraft(null);
                  reload();
                }}
              />
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
