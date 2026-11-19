import { useNow } from '../../../../renderer/core/useNow';
import { useUsage, windowLabel, type UsageWindow } from './usageStore';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** From here the bar turns red: the limit is close. */
const HIGH_USAGE = 0.9;

/** "Resets in 1 h 20 min" today, "Resets Wed 19:00" further out. */
export function resetLabel(resetsAt: number, now: number): string {
  const left = resetsAt - now;
  if (left <= 0) return 'Reset. Updates with your next message';
  if (left < HOUR_MS) return `Resets in ${Math.max(1, Math.round(left / MINUTE_MS))} min`;
  if (left < DAY_MS) {
    const hours = Math.floor(left / HOUR_MS);
    const minutes = Math.round((left % HOUR_MS) / MINUTE_MS);
    return `Resets in ${hours} h${minutes ? ` ${minutes} min` : ''}`;
  }
  const date = new Date(resetsAt);
  return `Resets ${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function updatedLabel(updatedAt: number, now: number): string {
  const minutes = Math.round((now - updatedAt) / MINUTE_MS);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Updated ${hours} h ago` : 'Updated over a day ago';
}

/** Re-renders every minute so "resets in" counts down. */

function Meter({ limit, now }: { limit: UsageWindow; now: number }) {
  const share = limit.resetsAt > now ? limit.utilization : 0;
  const percent = Math.round(share * 100);
  const label = windowLabel(limit.key);
  return (
    <div className="usage-meter">
      <div className="flex items-baseline justify-between">
        <span>{label}</span>
        <span className="usage-percent">{percent}%</span>
      </div>
      <div className="usage-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div data-high={share >= HIGH_USAGE} style={{ transform: `scaleX(${share})` }} />
      </div>
      <div className="usage-caption">{resetLabel(limit.resetsAt, now)}</div>
    </div>
  );
}

/** Account & Usage, like the Claude Code panel in VS Code: how much of each limit is used and when it resets. */
export function UsagePanel() {
  const { windows, plan, updatedAt } = useUsage();
  const now = useNow();

  return (
    <section className="usage-card" aria-label="Usage">
      <div className="flex items-center justify-between">
        <span className="usage-title">Usage</span>
        {plan && <span className="usage-plan">{plan}</span>}
      </div>
      {windows.length === 0 ? (
        <div className="usage-caption">Shows after your next message to Claude.</div>
      ) : (
        windows.map((limit) => <Meter key={limit.key} limit={limit} now={now} />)
      )}
      {updatedAt && windows.length > 0 && <div className="usage-caption">{updatedLabel(updatedAt, now)}</div>}
    </section>
  );
}
