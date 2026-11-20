import { useId } from 'react';
import { areaPath, chartPoints, smoothPath, type Point } from './chartPath';

/** bklit's "gradient glow": a smooth line over an accent fill that melts into the page. Goes inside an `<svg>`. */
export function GlowArea({ points, floor }: { points: Point[]; floor: number }) {
  const fill = `glow-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="glow-stop-top" />
          <stop offset="1" className="glow-stop-bottom" />
        </linearGradient>
      </defs>
      <path d={areaPath(points, floor)} fill={`url(#${fill})`} />
      <path className="glow-line" d={smoothPath(points)} vectorEffect="non-scaling-stroke" />
    </>
  );
}

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 32;

/** bklit's "quiet sparkline": the trend in a stat tile, no axes, no hover. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  return (
    <svg className="content-spark glow-fade" viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" aria-hidden>
      <GlowArea points={chartPoints(values, SPARK_WIDTH, SPARK_HEIGHT, 3, 3)} floor={SPARK_HEIGHT} />
    </svg>
  );
}
