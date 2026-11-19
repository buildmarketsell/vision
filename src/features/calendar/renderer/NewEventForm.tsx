import { useState, type FormEvent } from 'react';
import type { CalendarInfo, CalendarState, NewEventInput } from '../../../shared/calendar';

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Next full hour, one hour long; the end moves with the start. */
function defaults(calendars: CalendarInfo[]): NewEventInput {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const primary = calendars.find((calendar) => calendar.key.endsWith(`|${calendar.account}`)) ?? calendars[0];
  return { calendarKey: primary?.key ?? '', title: '', location: '', date: localDate(start), allDay: false, startTime: localTime(start), endTime: end.getDate() === start.getDate() ? localTime(end) : '23:59' };
}

export function NewEventForm({ calendars, initial, onSaved, onCancel }: {
  calendars: CalendarInfo[];
  /** Date and times picked on the calendar page (a click on an empty slot). */
  initial?: Partial<NewEventInput>;
  onSaved: (state: CalendarState) => void;
  onCancel: () => void;
}) {
  const writable = calendars.filter((calendar) => calendar.writable);
  const [form, setForm] = useState(() => ({ ...defaults(writable), ...initial }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (change: Partial<NewEventInput>) => setForm({ ...form, ...change });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    window.vision.calendar
      .createEvent(form)
      .then((result) => (result.ok ? onSaved(result.value) : setError(result.error)), () => setError('The event was not saved. Try again.'))
      .finally(() => setBusy(false));
  };

  return (
    <form className="calendar-new enter" aria-label="New event" onSubmit={submit} onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <input className="calendar-title-input" value={form.title} placeholder="Event name" aria-label="Event name" autoFocus onChange={(event) => set({ title: event.target.value })} />
      <input className="calendar-input" type="date" value={form.date} aria-label="Date" onChange={(event) => set({ date: event.target.value })} />
      <label className="calendar-check">
        <input type="checkbox" checked={form.allDay} onChange={(event) => set({ allDay: event.target.checked })} /> All day
      </label>
      {!form.allDay && (
        <div className="flex items-center gap-2">
          <input className="calendar-input" type="time" value={form.startTime} aria-label="Start time" onChange={(event) => set({ startTime: event.target.value })} />
          <span className="caption">to</span>
          <input className="calendar-input" type="time" value={form.endTime} aria-label="End time" onChange={(event) => set({ endTime: event.target.value })} />
        </div>
      )}
      <input className="calendar-input" value={form.location} placeholder="Location (optional)" aria-label="Location" onChange={(event) => set({ location: event.target.value })} />
      <select className="calendar-input" value={form.calendarKey} aria-label="Calendar" onChange={(event) => set({ calendarKey: event.target.value })}>
        {writable.map((calendar) => (
          <option key={calendar.key} value={calendar.key}>
            {calendar.name}
          </option>
        ))}
      </select>
      {error && <div className="calendar-error" role="alert">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="button-primary" disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Add event'}</button>
      </div>
    </form>
  );
}
