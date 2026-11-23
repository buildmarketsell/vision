import { memo, useId, type ReactNode } from 'react';
import { FACE_COLOURS, type AgentFace as Face, type AgentMood, type FaceShape } from '../../../shared/agents';

/**
 * An agent's face, after Bupsy's face gallery: a gummy shape lit from above, with two eyes that show its mood.
 * Drawn in a 120-unit box. Only working, waiting, done and failed faces move (Bupsy measured idle motion as a
 * quarter of a core across a list); everything holds still under reduced motion.
 */

const MOOD_LABEL: Record<AgentMood, string> = { idle: 'idle', working: 'working', waiting: 'needs you', done: 'done', sleeping: 'asleep', failed: 'something went wrong' };

function mix(hex: string, other: string, amount: number): string {
  const channel = (value: string, at: number) => parseInt(value.slice(at, at + 2), 16);
  const parts = [1, 3, 5].map((at) => Math.round(channel(hex, at) * amount + channel(other, at) * (1 - amount)));
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function polygon(points: number, outer: number, inner: number | null, rotate = -90): string {
  const corners = inner === null ? points : points * 2;
  return Array.from({ length: corners }, (_, index) => {
    const radius = inner === null || index % 2 === 0 ? outer : inner;
    const angle = ((rotate + (360 / corners) * index) * Math.PI) / 180;
    return `${(60 + radius * Math.cos(angle)).toFixed(1)},${(62 + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

/** Each shape's body, and where its eyes sit (x centre, y, half the gap between them). */
const SHAPES: Record<FaceShape, { body: (fill: string) => ReactNode; eyes: [number, number, number] }> = {
  circle: { body: (fill) => <circle cx="60" cy="60" r="46" fill={fill} />, eyes: [60, 56, 12] },
  drop: { body: (fill) => <path d="M18 18 H62 C88 18 106 38 106 62 C106 88 86 106 60 106 C34 106 14 88 14 62 V24 Q14 18 18 18 Z" fill={fill} />, eyes: [62, 60, 12] },
  pick: { body: (fill) => <path d="M26 16 Q16 12 16 24 V96 Q16 108 26 104 L102 68 Q112 60 102 52 Z" fill={fill} />, eyes: [50, 60, 10] },
  triangle: { body: (fill) => <path d="M60 12 Q66 12 70 20 L108 94 Q112 104 100 104 H20 Q8 104 12 94 L50 20 Q54 12 60 12 Z" fill={fill} />, eyes: [60, 74, 9] },
  squircle: { body: (fill) => <path d="M60 12 C100 12 108 20 108 60 C108 100 100 108 60 108 C20 108 12 100 12 60 C12 20 20 12 60 12 Z" fill={fill} />, eyes: [60, 54, 12] },
  pill: { body: (fill) => <rect x="8" y="32" width="104" height="58" rx="29" fill={fill} />, eyes: [60, 58, 12] },
  pebble: { body: (fill) => <ellipse cx="60" cy="60" rx="38" ry="50" transform="rotate(-10 60 60)" fill={fill} />, eyes: [60, 54, 10] },
  ghost: {
    body: (fill) => <path d="M18 66 A42 42 0 0 1 102 66 L102 104 Q95 113 88 104 Q81 95 74 104 Q67 113 60 104 Q53 95 46 104 Q39 113 32 104 Q25 95 18 104 Z" fill={fill} />,
    eyes: [60, 56, 11],
  },
  cat: { body: (fill) => <path d="M22 54 L24 12 L50 34 Q60 31 70 34 L96 12 L98 54 Q108 68 102 82 Q94 106 60 106 Q26 106 18 82 Q12 68 22 54 Z" fill={fill} />, eyes: [60, 66, 12] },
  cloud: { body: (fill) => <path d="M30 96 Q10 96 10 77 Q10 60 28 58 Q30 34 54 32 Q72 30 80 46 Q100 42 106 62 Q112 82 96 94 Q92 96 86 96 Z" fill={fill} />, eyes: [60, 68, 11] },
  flower: {
    body: (fill) => (
      <g fill={fill}>
        <circle cx="60" cy="62" r="30" />
        {[0, 60, 120, 180, 240, 300].map((angle) => <circle key={angle} cx={60 + 28 * Math.cos((angle * Math.PI) / 180)} cy={62 + 28 * Math.sin((angle * Math.PI) / 180)} r="21" />)}
      </g>
    ),
    eyes: [60, 60, 11],
  },
  clover: {
    body: (fill) => (
      <g fill={fill}>
        <circle cx="60" cy="62" r="30" />
        <circle cx="60" cy="36" r="25" />
        <circle cx="60" cy="88" r="25" />
        <circle cx="34" cy="62" r="25" />
        <circle cx="86" cy="62" r="25" />
      </g>
    ),
    eyes: [60, 60, 11],
  },
  star: { body: (fill) => <polygon points={polygon(5, 54, 27)} fill={fill} stroke={fill} strokeWidth="10" strokeLinejoin="round" />, eyes: [60, 64, 9] },
  hexagon: { body: (fill) => <polygon points={polygon(6, 46, null, 0)} fill={fill} stroke={fill} strokeWidth="10" strokeLinejoin="round" />, eyes: [60, 60, 12] },
};

function Eyes({ mood, x, y, gap }: { mood: AgentMood; x: number; y: number; gap: number }) {
  const sides = [x - gap, x + gap];
  if (mood === 'done') return <g className="face-eyes" fill="none" stroke="#141414" strokeWidth="5.5" strokeLinecap="round">{sides.map((cx) => <path key={cx} d={`M${cx - 7} ${y + 4} Q${cx} ${y - 7} ${cx + 7} ${y + 4}`} />)}</g>;
  if (mood === 'sleeping') return <g className="face-eyes" fill="none" stroke="#141414" strokeWidth="5" strokeLinecap="round">{sides.map((cx) => <path key={cx} d={`M${cx - 7} ${y} Q${cx} ${y + 7} ${cx + 7} ${y}`} />)}</g>;
  if (mood === 'failed') return <g className="face-eyes" stroke="#141414" strokeWidth="5" strokeLinecap="round">{sides.map((cx) => <path key={cx} d={`M${cx - 6} ${y - 6} L${cx + 6} ${y + 6} M${cx + 6} ${y - 6} L${cx - 6} ${y + 6}`} />)}</g>;
  const lookY = mood === 'waiting' ? -2 : 0;
  return (
    <g className="face-eyes">
      {sides.map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={y + lookY} rx="7" ry="9.5" fill="#141414" />
          <circle cx={cx + 2.2} cy={y + lookY - 3.6} r="2.4" fill="#ffffff" />
        </g>
      ))}
    </g>
  );
}

export const AgentFace = memo(function AgentFace({ face, mood = 'idle', size = 28, label }: { face: Face; mood?: AgentMood; size?: number; label?: string }) {
  const id = useId();
  const tint = FACE_COLOURS[face.colour] ?? FACE_COLOURS[0];
  const shape = SHAPES[face.shape];
  const [x, y, baseGap] = shape.eyes;
  const gap = baseGap + 3;
  return (
    <svg className="agent-face" data-mood={mood} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label ? `${label}, ${MOOD_LABEL[mood]}` : MOOD_LABEL[mood]}>
      <defs>
        <linearGradient id={id} x1="0" y1="8" x2="0" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mix(tint, '#ffffff', 0.62)} />
          <stop offset="0.55" stopColor={tint} />
          <stop offset="1" stopColor={mix(tint, '#000000', 0.86)} />
        </linearGradient>
      </defs>
      <g className="face-body">
        {shape.body(`url(#${id})`)}
        <Eyes mood={mood} x={x} y={y} gap={gap} />
      </g>
    </svg>
  );
});
