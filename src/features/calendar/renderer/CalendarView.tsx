import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, MapPin, MoreHorizontal, RotateCw, Unlink } from 'lucide-react';
import type { CalendarState } from '../../../shared/calendar';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { useNow } from '../../../renderer/core/useNow';
import { groupAgenda, soonLabel, timeRange } from './agenda';
import './calendar.css';

const REFRESH_MS = 5 * 60_000;

function useCalendar() {
  const [state, setState] = useState<CalendarState | null>(null);
  const [busy, setBusy] = useState(false);
  const load = (action: Promise<CalendarState>) => {
    action
      .then(setState, () => setState({ kind: 'error', message: 'The calendar could not be read. Try again.' }))
      .finally(() => setBusy(false));
  };
  /** For clicks: shows the button as busy until the answer comes. */
  const run = (action: Promise<CalendarState>) => {
    setBusy(true);
    load(action);
  };
  useEffect(() => {
    load(window.vision.calendar.upcoming());
    const timer = setInterval(() => load(window.vision.calendar.upcoming()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return { state, busy, run };
}

function ConnectForm({ busy, error, onConnect }: { busy: boolean; error: string | null; onConnect: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim()) onConnect(url);
  };
  return (
    <form className="calendar-connect" onSubmit={submit}>
      <CalendarDays size={22} strokeWidth={1.5} className="text-(--color-text-muted)" aria-hidden />
      <div className="font-medium">Connect your Google Calendar</div>
      <ol className="calendar-steps">
        <li>Open Google Calendar on the web, then Settings.</li>
        <li>Click your calendar on the left, under "Settings for my calendars".</li>
        <li>Copy "Secret address in iCal format" and paste it here.</li>
      </ol>
      <input
        className="calendar-input"
        type="url"
        value={url}
        placeholder="https://calendar.google.com/calendar/ical/…"
        aria-label="Secret address in iCal format"
        onChange={(event) => setUrl(event.target.value)}
      />
      {error && <div className="calendar-error" role="alert">{error}</div>}
      <button type="submit" className="button-primary" disabled={busy || !url.trim()}>
        {busy ? 'Checking…' : 'Connect'}
      </button>
      <p className="caption">The link stays on this Mac. VISION only reads it.</p>
    </form>
  );
}

function Agenda({ state, now }: { state: Extract<CalendarState, { kind: 'ready' }>; now: number }) {
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
                <li key={event.id} className="calendar-event" data-all-day={event.allDay} data-now={soon === 'Now'}>
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

/** Sidebar view: what's coming up in Dan's Google Calendar, day by day. */
export function CalendarView() {
  const { state, busy, run } = useCalendar();
  const now = useNow();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const connected = state !== null && state.kind !== 'notConnected';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">Calendar</div>
        {connected && (
          <div className="flex items-center">
            <button className="icon-button" title="Refresh" aria-label="Refresh calendar" disabled={busy} onClick={() => run(window.vision.calendar.upcoming(true))}>
              <RotateCw size={14} strokeWidth={1.5} className={busy ? 'calendar-spinning' : undefined} />
            </button>
            <button className="icon-button" title="More" aria-label="Calendar options" onClick={(event) => setMenu({ x: event.clientX, y: event.clientY })}>
              <MoreHorizontal size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === null && <div className="spinner mx-auto mt-6" aria-label="Loading calendar" />}
        {state?.kind === 'notConnected' && <ConnectForm busy={busy} error={null} onConnect={(url) => run(window.vision.calendar.connect(url))} />}
        {state?.kind === 'error' && <ConnectForm busy={busy} error={state.message} onConnect={(url) => run(window.vision.calendar.connect(url))} />}
        {state?.kind === 'ready' && <Agenda state={state} now={now} />}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[{ label: 'Disconnect calendar', icon: <Unlink size={15} strokeWidth={1.5} />, danger: true, onSelect: () => run(window.vision.calendar.disconnect()) }]}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
