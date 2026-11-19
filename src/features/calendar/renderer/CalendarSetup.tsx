import { useState, type FormEvent } from 'react';
import { CalendarDays } from 'lucide-react';

/** First run: paste the Google Cloud client (once), then sign in with Google in the browser. */
export function CalendarSetup({ hasClient, busy, error, onSaveClient, onSignIn }: {
  hasClient: boolean;
  busy: boolean;
  error: string | undefined;
  onSaveClient: (id: string, secret: string) => void;
  onSignIn: () => void;
}) {
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [editing, setEditing] = useState(!hasClient);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSaveClient(id, secret);
    setEditing(false);
  };
  return (
    <div className="calendar-connect">
      <CalendarDays size={22} strokeWidth={1.5} className="text-(--color-text-muted)" aria-hidden />
      <div className="font-medium">Connect Google Calendar</div>
      {editing || !hasClient ? (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <p className="caption">Step 1 of 2. Paste the Client ID and Client secret from your Google Cloud project (Claude can walk you through it).</p>
          <input className="calendar-input" value={id} placeholder="Client ID (…apps.googleusercontent.com)" aria-label="Client ID" onChange={(event) => setId(event.target.value)} />
          <input className="calendar-input" type="password" value={secret} placeholder="Client secret" aria-label="Client secret" onChange={(event) => setSecret(event.target.value)} />
          {error && <div className="calendar-error" role="alert">{error}</div>}
          <button type="submit" className="button-primary" disabled={busy || !id.trim() || !secret.trim()}>
            Save
          </button>
        </form>
      ) : (
        <>
          <p className="caption">Step 2 of 2. Sign in in your browser, then come back here.</p>
          {error && <div className="calendar-error" role="alert">{error}</div>}
          <button className="button-primary" disabled={busy} onClick={onSignIn}>
            Sign in with Google
          </button>
          <button className="calendar-link" onClick={() => setEditing(true)}>
            Change Client ID
          </button>
        </>
      )}
      <p className="caption">Your sign-in is kept in the Mac Keychain. VISION reads your calendars and adds the events you create.</p>
    </div>
  );
}
