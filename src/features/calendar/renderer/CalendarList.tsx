import { LogOut, Plus } from 'lucide-react';
import type { CalendarState } from '../../../shared/calendar';

type Ready = Extract<CalendarState, { kind: 'ready' }>;

/** Accounts and their calendars: tick to show or hide, add another Google account, sign one out. */
export function CalendarList({ state, busy, onChange, onToggle, onSignIn }: {
  state: Ready;
  busy: boolean;
  onChange: (action: Promise<CalendarState>) => void;
  onToggle: (calendarKey: string, visible: boolean) => void;
  onSignIn: () => void;
}) {
  return (
    <div className="calendar-list enter" aria-label="Calendars">
      {state.accounts.map((account) => (
        <section key={account.email} aria-label={account.email}>
          <div className="calendar-account">
            <span className="min-w-0 flex-1 truncate">{account.email}</span>
            <button className="icon-button" title="Sign out of this account" aria-label={`Sign out ${account.email}`} onClick={() => onChange(window.vision.calendar.signOut(account.email))}>
              <LogOut size={13} strokeWidth={1.5} />
            </button>
          </div>
          {account.needsSignIn && (
            <button className="calendar-link px-2" onClick={onSignIn}>
              Google needs you to sign in again
            </button>
          )}
          {state.calendars
            .filter((calendar) => calendar.account === account.email)
            .map((calendar) => (
              <label key={calendar.key} className="calendar-toggle" style={{ ['--event-color' as string]: calendar.color }}>
                <input type="checkbox" checked={calendar.visible} onChange={(event) => onToggle(calendar.key, event.target.checked)} />
                <span className="truncate">{calendar.name}</span>
              </label>
            ))}
        </section>
      ))}
      <button className="calendar-add-account" disabled={busy} onClick={onSignIn}>
        <Plus size={14} strokeWidth={1.75} /> {busy ? 'Waiting for Google…' : 'Add Google account'}
      </button>
    </div>
  );
}
