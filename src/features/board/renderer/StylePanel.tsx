import type { ReactNode } from 'react';
import { BOARD_COLORS, DASHES, FILLS, FONTS, SIZES, type BoardStyle, type Dash, type Fill, type Font } from '../boardStyle';

const FILL_LABELS: Record<Fill, string> = { none: 'No fill', semi: 'Light fill', solid: 'Solid fill', pattern: 'Pattern fill' };
const DASH_LABELS: Record<Dash, string> = { draw: 'Hand-drawn', solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };
const FONT_LABELS: Record<Font, string> = { draw: 'Hand-drawn', sans: 'Sans', mono: 'Mono' };
const FONT_FAMILIES: Record<Font, string> = { draw: 'Excalifont', sans: 'Nunito', mono: 'Cascadia' };
const DASH_PATTERNS: Record<Dash, string | undefined> = { draw: undefined, solid: undefined, dashed: '5 3', dotted: '0.5 3.5' };

function DashIcon({ dash }: { dash: Dash }) {
  const path = dash === 'draw' ? 'M2 10 C5 6, 8 13, 11 9 S16 7, 18 9' : 'M2 9 H18';
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={DASH_PATTERNS[dash]} />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="board-style-row" role="group" aria-label={label}>
      {children}
    </div>
  );
}

interface StylePanelProps {
  style: BoardStyle;
  onChange: (style: BoardStyle) => void;
}

/** tldraw's style panel: color grid, fill, dash, size and font. */
export function StylePanel({ style, onChange }: StylePanelProps) {
  const set = (change: Partial<BoardStyle>) => onChange({ ...style, ...change });
  return (
    <div className="board-panel board-style-panel">
      <div className="board-color-grid" role="group" aria-label="Color">
        {BOARD_COLORS.map(({ id, hex }) => (
          <button key={id} className="board-button" title={id.replace('-', ' ')} aria-label={id} aria-pressed={style.color === id} onClick={() => set({ color: id })}>
            <span className="board-swatch" style={{ background: hex }} />
          </button>
        ))}
      </div>
      <div className="board-divider" />
      <Row label="Fill">
        {FILLS.map((fill) => (
          <button key={fill} className="board-button" title={FILL_LABELS[fill]} aria-label={FILL_LABELS[fill]} aria-pressed={style.fill === fill} onClick={() => set({ fill })}>
            <span className={`board-fill-icon board-fill-${fill}`} />
          </button>
        ))}
      </Row>
      <Row label="Line">
        {DASHES.map((dash) => (
          <button key={dash} className="board-button" title={DASH_LABELS[dash]} aria-label={DASH_LABELS[dash]} aria-pressed={style.dash === dash} onClick={() => set({ dash })}>
            <DashIcon dash={dash} />
          </button>
        ))}
      </Row>
      <Row label="Size">
        {SIZES.map((size) => (
          <button key={size} className="board-button board-text-button" aria-label={`Size ${size.toUpperCase()}`} aria-pressed={style.size === size} onClick={() => set({ size })}>
            {size.toUpperCase()}
          </button>
        ))}
      </Row>
      <Row label="Font">
        {FONTS.map((font) => (
          <button
            key={font}
            className="board-button board-text-button"
            title={FONT_LABELS[font]}
            aria-label={`${FONT_LABELS[font]} font`}
            aria-pressed={style.font === font}
            style={{ fontFamily: FONT_FAMILIES[font] }}
            onClick={() => set({ font })}
          >
            Aa
          </button>
        ))}
      </Row>
    </div>
  );
}
