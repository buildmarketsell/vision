import { useState, type PointerEvent } from 'react';
import type { Snapshot } from '../../../shared/content';
import { fullNumber, shortDate, shortNumber } from './format';

const WIDTH = 600;
const HEIGHT = 140;
const PAD_Y = 12;

const dayToMs = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
};

/** Followers over time, one point per saved day. One series, so the title names it and there is no legend. */
export function GrowthChart({ label, history }: { label: string; history: Snapshot[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) {
    return <p className="content-note">The growth line starts tomorrow: VISION saves one reading a day while it is open.</p>;
  }
  const values = history.map((item) => item.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => (index / (history.length - 1)) * WIDTH;
  const y = (value: number) => PAD_Y + (1 - (value - min) / span) * (HEIGHT - PAD_Y * 2);
  const path = history.map((item, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(item.followers).toFixed(1)}`).join(' ');
  const point = hover === null ? null : history[hover];

  const track = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover(Math.round(ratio * (history.length - 1)));
  };

  return (
    <figure className="content-chart">
      <figcaption className="content-chart-head">
        <span>{label}</span>
        <span className="content-chart-range">
          {shortDate(dayToMs(history[0]?.day ?? ''))} – {shortDate(dayToMs(history[history.length - 1]?.day ?? ''))}
        </span>
      </figcaption>
      <div className="content-chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${label}: from ${fullNumber(values[0] ?? 0)} to ${fullNumber(values[values.length - 1] ?? 0)}`} onPointerMove={track} onPointerLeave={() => setHover(null)}>
          <line className="content-chart-base" x1={0} x2={WIDTH} y1={HEIGHT - PAD_Y} y2={HEIGHT - PAD_Y} vectorEffect="non-scaling-stroke" />
          <path className="content-chart-line" d={path} vectorEffect="non-scaling-stroke" />
          {hover !== null && <line className="content-chart-cross" x1={x(hover)} x2={x(hover)} y1={0} y2={HEIGHT} vectorEffect="non-scaling-stroke" />}
        </svg>
        {point && hover !== null && (
          <>
            <span className="content-chart-dot" style={{ left: `${(x(hover) / WIDTH) * 100}%`, top: `${(y(point.followers) / HEIGHT) * 100}%` }} aria-hidden />
            <div className="content-chart-tip" style={{ left: `${(x(hover) / WIDTH) * 100}%` }} role="status">
              <span className="caption">{shortDate(dayToMs(point.day))}</span>
              <strong>{fullNumber(point.followers)}</strong>
            </div>
          </>
        )}
        <span className="content-chart-axis content-chart-axis-top">{shortNumber(max)}</span>
        <span className="content-chart-axis content-chart-axis-bottom">{shortNumber(min)}</span>
      </div>
    </figure>
  );
}
