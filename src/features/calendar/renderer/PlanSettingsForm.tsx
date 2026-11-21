import { useState } from 'react';
import type { CalendarInfo } from '../../../shared/calendar';
import { HOURS_NAMES, type HoursName, type PlanSettings, type WeekHours } from '../../../shared/plan';

/** Monday first, like the week page. */
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const dayName = (day: number) => new Date(2026, 10, 22 + day).toLocaleDateString(undefined, { weekday: 'short' });

function HoursTable({ week, onChange }: { week: WeekHours; onChange: (week: WeekHours) => void }) {
  const set = (day: number, range: { from: string; to: string } | null) => {
    const next = { ...week };
    if (range) next[day] = range;
    else delete next[day];
    onChange(next);
  };
  return (
    <div className="plan-hours">
      {DAYS.map((day) => {
        const range = week[day];
        return (
          <div key={day} className="plan-hours-row">
            <label className="calendar-check">
              <input type="checkbox" checked={range !== undefined} onChange={(event) => set(day, event.target.checked ? { from: '09:00', to: '17:00' } : null)} />
              {dayName(day)}
            </label>
            {range ? (
              <>
                <input className="calendar-input" type="time" value={range.from} aria-label={`${dayName(day)} from`} onChange={(event) => set(day, { ...range, from: event.target.value })} />
                <span className="caption">to</span>
                <input className="calendar-input" type="time" value={range.to} aria-label={`${dayName(day)} to`} onChange={(event) => set(day, { ...range, to: event.target.value })} />
              </>
            ) : (
              <span className="caption">No hours</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** When tasks may be planned, and which Google calendar gets the blocks. */
export function PlanSettingsForm({ settings, calendars, onSave, onCancel }: {
  settings: PlanSettings;
  calendars: CalendarInfo[];
  onSave: (settings: PlanSettings) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [tab, setTab] = useState<HoursName>('work');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writable = calendars.filter((calendar) => calendar.writable);
  const backwards = Object.values(draft.hours).some((week) => Object.values(week).some((range) => range && range.from >= range.to));

  const save = () => {
    setSaving(true);
    setError(null);
    onSave(draft).catch(() => setError('The settings were not saved. Try again.')).finally(() => setSaving(false));
  };

  return (
    <form className="calendar-new plan-settings" aria-label="Plan settings" onSubmit={(event) => { event.preventDefault(); save(); }} onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <label className="calendar-check">
        <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> Plan my to-dos automatically
      </label>
      <div className="segmented" role="radiogroup" aria-label="Hours">
        {HOURS_NAMES.map((item) => (
          <button key={item.value} type="button" role="radio" aria-checked={tab === item.value} data-active={tab === item.value} onClick={() => setTab(item.value)}>
            {item.label} hours
          </button>
        ))}
      </div>
      <HoursTable week={draft.hours[tab]} onChange={(week) => setDraft({ ...draft, hours: { ...draft.hours, [tab]: week } })} />
      <label className="plan-field">
        <span className="caption">Copy planned blocks to</span>
        <select className="calendar-input" value={draft.calendarKey ?? ''} aria-label="Copy planned blocks to" onChange={(event) => setDraft({ ...draft, calendarKey: event.target.value || null })}>
          <option value="">Only VISION</option>
          {writable.map((calendar) => (
            <option key={calendar.key} value={calendar.key}>
              {calendar.name}
            </option>
          ))}
        </select>
      </label>
      {backwards && <div className="calendar-error" role="alert">Each day's end has to be after its start.</div>}
      {error && <div className="calendar-error" role="alert">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="button-primary" disabled={saving || backwards}>{saving ? 'Planning…' : 'Save'}</button>
      </div>
    </form>
  );
}
