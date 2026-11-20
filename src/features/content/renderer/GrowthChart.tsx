import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Snapshot } from '../../../shared/content';
import { GlowArea } from './GlowArea';
import { axisTicks, chartPoints } from './chartPath';
import { fullNumber, shortDate, weekdayDate } from './format';
import './chart.css';

const WIDTH = 600;
const HEIGHT = 200;
/** Headroom for the tooltip above the line, and a deep floor so the glow has room to fade. */
const TOP = 40;
const BOTTOM = 70;

export interface ChartMetric {
  label: string;
  pick: (snapshot: Snapshot) => number | null;
}

const dayToMs = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
};

const percent = (x: number) => `${(x / WIDTH) * 100}%`;

/** A number over time, one point per saved day, in bklit's gradient glow. More than one metric adds a switch. */
export function GrowthChart({ metrics, history }: { metrics: ChartMetric[]; history: Snapshot[] }) {
  const [picked, setPicked] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const metric = metrics[picked] ?? metrics[0];
  if (!metric) return null;
  const readings = history.flatMap((item) => {
    const value = metric.pick(item);
    return value === null ? [] : [{ day: dayToMs(item.day), value }];
  });
  const values = readings.map((reading) => reading.value);
  const points = chartPoints(values, WIDTH, HEIGHT, TOP, BOTTOM);
  const shown = hover === null ? null : readings[hover];
  const hoverX = hover === null ? 0 : (points[hover]?.[0] ?? 0);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover(Math.round(ratio * (readings.length - 1)));
  };

  // Left and right arrows walk the readings, so the numbers can be read without a mouse.
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const from = hover ?? (move > 0 ? -1 : readings.length);
    setHover(Math.min(readings.length - 1, Math.max(0, from + move)));
  };

  return (
    <figure className="content-chart">
      <figcaption className="content-chart-head">
        {metrics.length > 1 ? (
          <div className="segmented" role="radiogroup" aria-label="Chart">
            {metrics.map((item, index) => (
              <button key={item.label} role="radio" aria-checked={index === picked} data-active={index === picked} onClick={() => { setPicked(index); setHover(null); }}>
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <span>{metric.label}</span>
        )}
        {readings.length > 1 && (
          <span className="content-chart-range">
            {shortDate(readings[0]?.day ?? 0)} – {shortDate(readings[readings.length - 1]?.day ?? 0)}
          </span>
        )}
      </figcaption>
      {readings.length < 2 ? (
        <p className="content-note">The growth line starts tomorrow: VISION saves one reading a day while it is open.</p>
      ) : (
        <div className="content-chart-plot" tabIndex={0} aria-label={`${metric.label} by day: use the arrow keys to read each day`} onPointerMove={track} onPointerLeave={() => setHover(null)} onKeyDown={step} onBlur={() => setHover(null)}>
          <svg className="glow-fade" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${metric.label}: from ${fullNumber(values[0] ?? 0)} to ${fullNumber(values[values.length - 1] ?? 0)}`}>
            <GlowArea points={points} floor={HEIGHT} />
          </svg>
          {shown && hover !== null && (
            <>
              <span className="content-chart-cross" style={{ left: percent(hoverX) }} aria-hidden />
              <span className="content-chart-dot" style={{ left: percent(hoverX), top: `${((points[hover]?.[1] ?? 0) / HEIGHT) * 100}%` }} aria-hidden />
              <div className={`content-chart-tip${hoverX > WIDTH * 0.6 ? ' content-chart-tip-left' : ''}`} style={{ left: percent(hoverX) }} role="status">
                <div className="content-chart-tip-date">{weekdayDate(shown.day)}</div>
                <div className="content-chart-tip-row">
                  <span className="content-chart-tip-key" aria-hidden />
                  <span>{metric.label}</span>
                  <strong>{fullNumber(shown.value)}</strong>
                </div>
              </div>
            </>
          )}
          <div className="content-chart-axis" aria-hidden>
            {axisTicks(readings.length).map((index) => {
              const x = points[index]?.[0] ?? 0;
              const covered = hover !== null && Math.abs(x - hoverX) < WIDTH * 0.12;
              return <span key={index} style={{ left: percent(x), visibility: covered ? 'hidden' : undefined }}>{shortDate(readings[index]?.day ?? 0)}</span>;
            })}
            {shown && <span className="content-chart-pill" style={{ left: percent(hoverX) }}>{shortDate(shown.day)}</span>}
          </div>
        </div>
      )}
    </figure>
  );
}
