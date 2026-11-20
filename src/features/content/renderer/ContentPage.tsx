import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { PLATFORMS, type ContentState, type Platform } from '../../../shared/content';
import { PlatformSection } from './PlatformSection';
import { shortNumber } from './format';
import './content.css';

/** The page asks again this often while it is open; main's own cache keeps YouTube's free quota safe. */
const POLL_MS = 15 * 60_000;

function useContent() {
  const [state, setState] = useState<ContentState | null>(null);
  const [busy, setBusy] = useState<Platform | 'refresh' | null>(null);
  const [failed, setFailed] = useState(false);
  const run = (kind: Platform | 'refresh', action: Promise<ContentState>) => {
    setBusy(kind);
    action.then(
      (next) => {
        setState(next);
        setFailed(false);
      },
      () => setFailed(true),
    ).finally(() => setBusy(null));
  };
  useEffect(() => {
    const load = () => window.vision.content.state().then(setState, () => setFailed(true));
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return { state, busy, failed, run };
}

/** Totals across connected platforms, so the first thing on the page is the whole audience. */
function Overview({ state }: { state: ContentState }) {
  const stats = PLATFORMS.flatMap((platform) => {
    const entry = state[platform];
    return entry.connected && entry.stats ? [entry.stats] : [];
  });
  if (stats.length === 0) return null;
  const audience = stats.reduce((sum, item) => sum + item.followers, 0);
  const youtube = state.youtube.connected ? state.youtube.stats : null;
  const instagram = state.instagram.connected ? state.instagram.stats : null;
  return (
    <div className="content-overview" aria-label="Overview">
      <div className="content-hero">
        <span className="content-tile-label">Total audience</span>
        <span className="content-hero-value">{shortNumber(audience)}</span>
        <span className="caption">{stats.length === 2 ? 'YouTube subscribers + Instagram followers' : 'Connect the other platform to add it here'}</span>
      </div>
      {youtube && (
        <div className="content-tile">
          <span className="content-tile-label">YouTube views, all time</span>
          <span className="content-tile-value">{shortNumber(youtube.totalViews)}</span>
        </div>
      )}
      {instagram && (
        <div className="content-tile">
          <span className="content-tile-label">Instagram views, 28 days</span>
          <span className="content-tile-value">{shortNumber(instagram.last28Days?.views ?? null)}</span>
        </div>
      )}
    </div>
  );
}

/** Content in the menu: Dan's YouTube and Instagram at a glance. More content tools will join this page. */
export function ContentPage() {
  const { state, busy, failed, run } = useContent();
  return (
    <div className="content-page">
      <div className="content-column">
        <header className="content-page-head">
          <h1 className="content-page-title">Content</h1>
          <span className="flex-1" />
          <button className="icon-button" title="Refresh numbers" aria-label="Refresh numbers" disabled={busy !== null} onClick={() => run('refresh', window.vision.content.state(true))}>
            <RotateCw size={14} strokeWidth={1.5} className={busy === 'refresh' ? 'content-spinning' : undefined} />
          </button>
        </header>
        {failed && <div className="content-error" role="alert">The numbers could not be loaded. Press refresh to try again.</div>}
        {!state && !failed && <div className="spinner my-6" aria-label="Loading content" />}
        {state && (
          <>
            <Overview state={state} />
            {PLATFORMS.map((platform) => (
              <PlatformSection
                key={platform}
                platform={platform}
                state={state[platform]}
                busy={busy === platform}
                onConnect={(first, second) =>
                  run(platform, platform === 'youtube' ? window.vision.content.connectYouTube(first, second) : window.vision.content.connectInstagram(first))
                }
                onDisconnect={() => run(platform, window.vision.content.disconnect(platform))}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
