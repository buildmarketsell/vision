import { useEffect, useState } from 'react';
import { ListFilter, MapPin, Plus, RotateCw } from 'lucide-react';
import type { CalendarState } from '../../../shared/calendar';
import { useNow } from '../../../renderer/core/useNow';
import { groupAgenda, soonLabel, timeRange } from './agenda';
import { CalendarList } from './CalendarList';
import { CalendarSetup } from './CalendarSetup';
import { NewEventForm } from './NewEventForm';
import './calendar.css';

const REFRESH_MS = 5 * 60_000;
type Ready = Extract<CalendarState, { kind: 'ready' }>;

/** What the view is waiting for: Google's sign-in in the browser (can be cancelled), or anything else. */
type Waiting = 'signIn' | 'other' | null;

function useCalendar() {
  const [state, setState] = useState<CalendarState | null>(null);
  const [waiting, setWaiting] = useState<Waiting>(null);
  const busy = waiting !== null;
  const load = (action: Promise<CalendarState>) => {
    action
      .then(setState, () => setState((current) => (current?.kind === 'ready' ? { ...current, error: 'The calendar could not be read. Try again.' } : { kind: 'setup', hasClient: false, error: 'The calendar could not be read. Try again.' })))
      .finally(() => setWaiting(null));
  };
  /** For clicks: shows the button as busy until the answer comes. */
  const run = (action: Promise<CalendarState>, kind: Waiting = 'other') => {
    setWaiting(kind);
    load(action);
  };
  useEffect(() => {
    load(window.vision.calendar.state());
    const timer = setInterval(() => load(window.vision.calendar.state()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return { state, setState, busy, waiting, run };
}

/** Shown while Google's sign-in is open in the browser; without it a stuck sign-in looked like broken buttons. */
function WaitingForGoogle() {
  return (
    <div className="calendar-waiting enter" role="status">
      <div className="spinner" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Waiting for Google…</div>
        <div className="caption">Finish signing in in your browser. If Google says "Access blocked", add your email as a test user in Google Cloud.</div>
        <button className="button-secondary mt-2" onClick={() => window.vision.calendar.cancelSignIn()}>Cancel</button>
      </div>
    </div>
  );
}

function Agenda({ state, now }: { state: Ready; now: number }) {
  const days = groupAgenda(state.events, now);
  if (days.length === 0) return <p className="calendar-empty">Nothing in the next two weeks.</p>;
  return (
    <div className="calendar-agenda" aria-label="Upcoming events">
      {days.map((day) => (
        <section key={day.key} aria-label={`${day.label}, ${day.date}`}>
          <h3 className="calendar-day">
            <span>{day.label}</span>
            <span className="calendar-date">{day.date}</span>
          </h3>
          <ul className="flex flex-col gap-1">
            {day.events.map((event) => {
              const soon = soonLabel(event, now);
              return (
                <li key={event.id} className="calendar-event" data-all-day={event.allDay} data-now={soon === 'Now'} style={{ ['--event-color' as string]: event.color }}>
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 font-medium">{event.title}</span>
                    {soon && <span className="calendar-soon">{soon}</span>}
                  </div>
                  <div className="calendar-meta">{timeRange(event)}</div>
                  {event.location && (
                    <div className="calendar-meta flex items-center gap-1">
                      <MapPin size={11} strokeWidth={1.75} aria-hidden />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Sidebar view: what's coming up in Dan's Google calendars, day by day, and a quick way to add an event. */
export function CalendarView() {
  const { state, setState, busy, waiting, run } = useCalendar();
  const now = useNow();
  const [panel, setPanel] = useState<'none' | 'new' | 'calendars'>('none');
  const toggle = (next: 'new' | 'calendars') => setPanel(panel === next ? 'none' : next);
  const signIn = () => run(window.vision.calendar.signIn(), 'signIn');
  /** The tick shows at once; the agenda follows when main answers (no network, it filters what it has). */
  const toggleCalendar = (key: string, visible: boolean) => {
    setState((current) => (current?.kind === 'ready' ? { ...current, calendars: current.calendars.map((item) => (item.key === key ? { ...item, visible } : item)) } : current));
    void window.vision.calendar.setVisible(key, visible).then(setState, () => undefined);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">Calendar</div>
        {state?.kind === 'ready' && (
          <div className="flex items-center">
            <button className="icon-button" title="New event" aria-label="New event" aria-pressed={panel === 'new'} onClick={() => toggle('new')}>
              <Plus size={16} strokeWidth={1.5} />
            </button>
            <button className="icon-button" title="Calendars and accounts" aria-label="Calendars and accounts" aria-pressed={panel === 'calendars'} onClick={() => toggle('calendars')}>
              <ListFilter size={15} strokeWidth={1.5} />
            </button>
            <button className="icon-button" title="Refresh" aria-label="Refresh calendar" disabled={busy} onClick={() => run(window.vision.calendar.state(true))}>
              <RotateCw size={14} strokeWidth={1.5} className={busy ? 'calendar-spinning' : undefined} />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {waiting === 'signIn' && <WaitingForGoogle />}
        {state === null && <div className="spinner mx-auto mt-6" aria-label="Loading calendar" />}
        {state?.kind === 'setup' && (
          <CalendarSetup
            key={String(state.hasClient)}
            hasClient={state.hasClient}
            busy={busy}
            error={state.error}
            onSaveClient={(id, secret) => run(window.vision.calendar.setClient(id, secret))}
            onSignIn={signIn}
          />
        )}
        {state?.kind === 'ready' && (
          <>
            {state.error && <div className="calendar-error mx-4 mb-2" role="alert">{state.error}</div>}
            {panel === 'new' && (
              <NewEventForm
                calendars={state.calendars}
                onCancel={() => setPanel('none')}
                onSaved={(next) => {
                  setState(next);
                  setPanel('none');
                }}
              />
            )}
            {panel === 'calendars' && <CalendarList state={state} busy={busy} onChange={run} onToggle={toggleCalendar} onSignIn={signIn} />}
            <Agenda state={state} now={now} />
          </>
        )}
      </div>
    </div>
  );
}
