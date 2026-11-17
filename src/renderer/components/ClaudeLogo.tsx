
/** Ray lengths (out of 10) for the starburst, uneven like a hand-drawn spark. */
const RAYS = [10, 7.6, 9.2, 7.2, 9.8, 8, 9.4, 7.4, 10, 7.8, 9];

interface ClaudeLogoProps {
  size?: number;
  /** Pulses gently while Claude is working. */
  busy?: boolean;
  /** Faded when the session isn't running. */
  dim?: boolean;
}

/** Claude's orange starburst mark, used for every Claude session. */
export function ClaudeLogo({ size = 16, busy = false, dim = false }: ClaudeLogoProps) {
  const center = 12;
  return (
    <svg
      className="claude-logo shrink-0"
      data-busy={busy}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ opacity: dim ? 0.4 : 1 }}
    >
      <g style={{ stroke: 'var(--color-claude)' }} strokeWidth={2.3} strokeLinecap="round">
        {RAYS.map((length, index) => {
          const angle = (index / RAYS.length) * Math.PI * 2 - Math.PI / 2;
          const inner = 1.2;
          return (
            <line
              key={index}
              x1={center + Math.cos(angle) * inner}
              y1={center + Math.sin(angle) * inner}
              x2={center + Math.cos(angle) * (length + 0.6)}
              y2={center + Math.sin(angle) * (length + 0.6)}
            />
          );
        })}
      </g>
    </svg>
  );
}
