import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import type { CalendarState, NewEventInput } from '../../../shared/calendar';
import { useLatest } from '../../../renderer/core/useLatest';
import { useNow } from '../../../renderer/core/useNow';
import { usePlan } from '../../../renderer/core/usePlan';
import { BlockCard, RiskList } from './PlanPopovers';
import { PlanSettingsForm } from './PlanSettingsForm';
import { useCalendarVersion } from './calendarSync';
import { NewEventForm } from './NewEventForm';
import { WeekGrid, type BlockPick, type SlotPick, type TimeSlot } from './WeekGrid';
import { addDays, clockTime, DAYS_IN_WEEK, startOfWeek, weekDays, weekTitle } from './weekLayout';
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
  // Signing in or changing calendars in the panel shows up here at once, not at the next 5-minute refresh.
  const version = useCalendarVersion((store) => store.version);
  const latestWeek = useLatest(weekStart);
  useEffect(() => {
    if (version > 0) load(latestWeek.current, true);
  }, [version, latestWeek]);
  return {
    state: result?.state ?? null,
    loading: result?.weekStart !== weekStart,
    failed,
    reload: () => load(weekStart, true),
  };
}

type Draft = { initial: Partial<NewEventInput>; left: number; top: number; slot: TimeSlot | null };
/** The other popovers: a planned block, the at-risk list, plan settings. */
type Panel = { kind: 'block'; pick: BlockPick } | { kind: 'risks' } | { kind: 'settings' };

const placeAt = (x: number, y: number, height: number) => ({
  left: Math.max(8, Math.min(x + 12, window.innerWidth - POPOVER.width - 8)),
  top: Math.max(8, Math.min(y - 40, window.innerHeight - height - 8)),
});

const pad = (value: number) => String(value).padStart(2, '0');

function draftFromPick(pick: SlotPick): Draft {
  const date = new Date(pick.dayStart);
  return {
    initial: {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      startTime: clockTime(pick.start),
      endTime: clockTime(pick.end),
    },
    ...placeAt(pick.x, pick.y, POPOVER.height),
    slot: { dayStart: pick.dayStart, start: pick.start, end: pick.end },
  };
}

/** The calendar as a page, like Notion Calendar: a week at a time, click an empty slot to add an event. */
export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(Date.now()));
  const { state, loading, failed, reload } = useWeek(weekStart);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const plan = usePlan();
  const ready = state?.kind === 'ready' ? state : null;
  const canAdd = ready?.calendars.some((calendar) => calendar.writable) ?? false;
  // VISION's own blocks in Google still to come are drawn from the plan instead (they move); past ones stay as a record.
  const now = useNow();
  const events = (ready?.events ?? []).filter((event) => !(event.taskId && event.end > now));
  const risks = plan?.risks ?? [];
  const panelPlace = panel?.kind === 'block' ? placeAt(panel.pick.x, panel.pick.y, 220) : { left: Math.max(8, window.innerWidth - 360 - 24), top: 64 };

  const openNew = () => setDraft({ initial: {}, left: Math.max(8, window.innerWidth - POPOVER.width - 24), top: 64, slot: null });

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
        {risks.length > 0 && (
          <button className="plan-risk-button" onClick={() => setPanel({ kind: 'risks' })}>
            {risks.length} at risk
          </button>
        )}
        <button className="icon-button" title="Plan settings" aria-label="Plan settings" onClick={() => setPanel({ kind: 'settings' })}>
          <SlidersHorizontal size={14} strokeWidth={1.5} />
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
      {plan?.error && (
        <div className="calendar-error px-6 pb-2" role="alert">
          {plan.error}
        </div>
      )}
      {ready?.error && (
        <div className="calendar-error px-6 pb-2" role="alert">
          {ready.error}
        </div>
      )}
      {state?.kind === 'setup' && <p className="calendar-empty px-6">Connect Google Calendar in the Calendar view of the sidebar first.</p>}
      <WeekGrid
        days={weekDays(weekStart)}
        events={events}
        blocks={plan?.blocks ?? []}
        pending={draft?.slot ?? null}
        onPick={(pick) => canAdd && setDraft(draftFromPick(pick))}
        onBlock={(pick) => setPanel({ kind: 'block', pick })}
      />
      {panel &&
        plan &&
        createPortal(
          <>
            <div className="calendar-scrim" onClick={() => setPanel(null)} aria-hidden />
            <div className="calendar-popover" style={{ ...panelPlace, width: panel.kind === 'block' ? POPOVER.width : 360 }}>
              {panel.kind === 'block' && <BlockCard block={panel.pick.block} onClose={() => setPanel(null)} />}
              {panel.kind === 'risks' && <RiskList risks={risks} onClose={() => setPanel(null)} />}
              {panel.kind === 'settings' && (
                <PlanSettingsForm
                  settings={plan.settings}
                  calendars={ready?.calendars ?? []}
                  onCancel={() => setPanel(null)}
                  onSave={async (settings) => {
                    await window.vision.plan.setSettings(settings);
                    setPanel(null);
                    reload();
                  }}
                />
              )}
            </div>
          </>,
          document.body,
        )}
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
