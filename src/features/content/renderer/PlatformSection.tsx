import { Camera, ExternalLink, Eye, Heart, MessageCircle, PlaySquare } from 'lucide-react';
import { growth, platformName, type AccountStats, type Platform, type PlatformState, type PostStat, type Snapshot } from '../../../shared/content';
import { ConnectForm } from './ConnectForm';
import { Sparkline } from './GlowArea';
import { GrowthChart, type ChartMetric } from './GrowthChart';
import { shortDate, shortNumber, signed } from './format';

const ICON = { size: 14, strokeWidth: 1.75 };

const followers = (snapshot: Snapshot) => snapshot.followers;
const totalViews = (snapshot: Snapshot) => snapshot.totalViews;
const trend = (history: Snapshot[], pick: ChartMetric['pick']) => history.flatMap((item) => pick(item) ?? []);

function Tile({ label, value, change, values }: { label: string; value: number | null; change?: string | null; values?: number[] }) {
  return (
    <div className="content-tile">
      <span className="content-tile-label">{label}</span>
      <span className="content-tile-value">{shortNumber(value)}</span>
      {change && <span className="content-tile-change">{change}</span>}
      {values && <Sparkline values={values} />}
    </div>
  );
}

function tilesFor(platform: Platform, stats: AccountStats, history: Snapshot[]) {
  const followerChange = signed(growth(history, 7, followers));
  if (platform === 'youtube') {
    const viewChange = signed(growth(history, 28, totalViews));
    return (
      <>
        <Tile label="Subscribers" value={stats.followers} change={followerChange && `${followerChange} in 7 days`} values={trend(history, followers)} />
        <Tile label="Total views" value={stats.totalViews} change={viewChange && `${viewChange} in 28 days`} values={trend(history, totalViews)} />
        <Tile label="Videos" value={stats.posts} />
      </>
    );
  }
  const period = stats.last28Days;
  return (
    <>
      <Tile label="Followers" value={stats.followers} change={followerChange && `${followerChange} in 7 days`} values={trend(history, followers)} />
      <Tile label="Views, 28 days" value={period?.views ?? null} />
      <Tile label="Reach, 28 days" value={period?.reach ?? null} />
      <Tile label="Profile visits, 28 days" value={period?.profileViews ?? null} />
      <Tile label="Posts" value={stats.posts} />
    </>
  );
}

function PostCard({ post }: { post: PostStat }) {
  return (
    <a className="content-post" href={post.url} target="_blank" rel="noreferrer">
      <div className="content-post-thumb">{post.thumbnail && <img src={post.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
      <span className="content-post-title">{post.title}</span>
      <span className="content-post-meta">
        <span>{shortDate(post.publishedAt)}</span>
        {post.views !== null && <span title="Views"><Eye {...ICON} aria-label="Views" /> {shortNumber(post.views)}</span>}
        {post.likes !== null && <span title="Likes"><Heart {...ICON} aria-label="Likes" /> {shortNumber(post.likes)}</span>}
        {post.comments !== null && <span title="Comments"><MessageCircle {...ICON} aria-label="Comments" /> {shortNumber(post.comments)}</span>}
      </span>
    </a>
  );
}

const YOUTUBE_CHART: ChartMetric[] = [{ label: 'Subscribers', pick: followers }, { label: 'Views', pick: totalViews }];
const INSTAGRAM_CHART: ChartMetric[] = [{ label: 'Followers', pick: followers }];

/** One platform on the dashboard: its connect form, or its numbers, growth line and latest posts. */
export function PlatformSection({ platform, state, busy, onConnect, onDisconnect }: {
  platform: Platform;
  state: PlatformState;
  busy: boolean;
  onConnect: (first: string, second: string) => void;
  onDisconnect: () => void;
}) {
  const name = platformName[platform];
  const stats = state.connected ? state.stats : null;
  const PlatformIcon = platform === 'youtube' ? PlaySquare : Camera;
  return (
    <section className="content-section" aria-label={name}>
      <header className="content-section-head">
        {stats?.avatar ? <img className="content-avatar" src={stats.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="content-avatar content-avatar-empty"><PlatformIcon size={16} strokeWidth={1.5} /></span>}
        <div className="min-w-0">
          <div className="content-section-title">{stats?.name ?? name}</div>
          <div className="caption">{stats ? `${name} · ${stats.handle}` : state.connected ? 'Loading…' : 'Not connected'}</div>
        </div>
        <span className="flex-1" />
        {stats && (
          <a className="button-secondary" href={stats.url} target="_blank" rel="noreferrer">
            Open <ExternalLink size={12} strokeWidth={1.75} />
          </a>
        )}
        {state.connected && <button className="button-secondary" onClick={onDisconnect}>Disconnect</button>}
      </header>
      {!state.connected && <ConnectForm platform={platform} busy={busy} error={state.error} onConnect={onConnect} />}
      {state.connected && state.error && <div className="content-error" role="alert">{state.error}</div>}
      {state.connected && !stats && !state.error && <div className="spinner my-4" aria-label={`Loading ${name}`} />}
      {state.connected && stats && (
        <>
          <div className="content-tiles">{tilesFor(platform, stats, state.history)}</div>
          <GrowthChart metrics={platform === 'youtube' ? YOUTUBE_CHART : INSTAGRAM_CHART} history={state.history} />
          {stats.recent.length > 0 && (
            <>
              <h3 className="section-label">{platform === 'youtube' ? 'Latest videos' : 'Latest posts'}</h3>
              <div className="content-posts">{stats.recent.map((post) => <PostCard key={post.id} post={post} />)}</div>
            </>
          )}
        </>
      )}
    </section>
  );
}
