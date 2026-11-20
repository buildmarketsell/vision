import { useState, type FormEvent, type ReactNode } from 'react';
import type { Platform } from '../../../shared/content';

const STEPS: Record<Platform, ReactNode[]> = {
  youtube: [
    'In Google Cloud (the project you use for Calendar), open APIs & Services → Library and turn on “YouTube Data API v3”.',
    'Go to Credentials → Create credentials → API key. Restrict it to the YouTube Data API v3.',
    'Paste the key and your channel handle below.',
  ],
  instagram: [
    'Your Instagram must be a Business or Creator account (Settings → Account type).',
    'At developers.facebook.com create an app, add the “Instagram” product and pick API setup with Instagram login.',
    'Add your account under “Generate access tokens”, generate a token and paste it below. VISION renews it on its own.',
  ],
};

/** A platform that isn't connected: the steps to get a key or token, and the fields to paste it. */
export function ConnectForm({ platform, busy, error, onConnect }: {
  platform: Platform;
  busy: boolean;
  error: string | undefined;
  onConnect: (first: string, second: string) => void;
}) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const isYouTube = platform === 'youtube';
  const ready = first.trim() !== '' && (!isYouTube || second.trim() !== '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) onConnect(first, second);
  };
  return (
    <form className="content-connect" onSubmit={submit} aria-label={`Connect ${isYouTube ? 'YouTube' : 'Instagram'}`}>
      <ol className="content-steps">
        {STEPS[platform].map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      <div className="content-fields">
        <input className="content-input" type="password" value={first} autoComplete="off" placeholder={isYouTube ? 'API key' : 'Access token'} aria-label={isYouTube ? 'YouTube API key' : 'Instagram access token'} onChange={(event) => setFirst(event.target.value)} />
        {isYouTube && <input className="content-input" value={second} placeholder="@yourchannel or channel link" aria-label="YouTube channel" onChange={(event) => setSecond(event.target.value)} />}
        <button type="submit" className="button-primary" disabled={busy || !ready}>
          {busy ? 'Connecting…' : `Connect ${isYouTube ? 'YouTube' : 'Instagram'}`}
        </button>
      </div>
      {error && <div className="content-error" role="alert">{error}</div>}
      <p className="caption">The key stays in this Mac’s Keychain. VISION only reads numbers; it never posts.</p>
    </form>
  );
}
