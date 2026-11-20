import { useState, type KeyboardEvent } from 'react';
import { hexToRgb, hslToRgb, parseHex, rgbToHex, rgbToHsl, type Rgb } from '../colorMath';

export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export const FORMATS: ColorFormat[] = ['hex', 'rgb', 'hsl'];

/** The hex box: live once six digits are typed, Enter or leaving commits, Escape reverts, a bad value shakes. */
export function HexField({ hex, onChange, onCommit }: { hex: string; onChange: (hex: string) => void; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseHex(draft);
    setDraft(null);
    if (parsed) onCommit(parsed);
    else setShaking(true);
  };
  return (
    <label className="cp-hex" data-shake={shaking} onAnimationEnd={() => setShaking(false)}>
      <span aria-hidden>#</span>
      <input
        aria-label="Hex color"
        spellCheck={false}
        maxLength={7}
        value={draft ?? hex.slice(1).toUpperCase()}
        onChange={(event) => {
          setDraft(event.target.value);
          const digits = event.target.value.replace(/^#/, '');
          const parsed = digits.length === 6 ? parseHex(digits) : undefined;
          if (parsed) onChange(parsed);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape' && draft !== null) {
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
    </label>
  );
}

const CHANNELS: Record<Exclude<ColorFormat, 'hex'>, { labels: string[]; max: number[] }> = {
  rgb: { labels: ['R', 'G', 'B'], max: [255, 255, 255] },
  hsl: { labels: ['H', 'S', 'L'], max: [360, 100, 100] },
};

/** Three number boxes (R G B or H S L). Arrow keys step 1, Shift+Arrow 10; Enter or leaving commits. */
export function ChannelFields({ format, hex, onCommit }: { format: Exclude<ColorFormat, 'hex'>; hex: string; onCommit: (hex: string) => void }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const values = format === 'rgb' ? hexToRgb(hex) : rgbToHsl(hexToRgb(hex));
  const { labels, max } = CHANNELS[format];
  const apply = (index: number, value: number) => {
    const next = [...values] as Rgb;
    next[index] = Math.min(max[index] ?? 0, Math.max(0, Math.round(value)));
    setDrafts({});
    onCommit(rgbToHex(format === 'rgb' ? next : hslToRgb(next)));
  };
  const commit = (index: number) => {
    const draft = drafts[index];
    if (draft === undefined) return;
    const number = Number(draft);
    if (draft.trim() === '' || Number.isNaN(number)) setDrafts({});
    else apply(index, number);
  };
  const onKeyDown = (index: number) => (event: KeyboardEvent) => {
    if (event.key === 'Enter') commit(index);
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    apply(index, (values[index] ?? 0) + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1));
  };
  return (
    <div className="cp-channels">
      {labels.map((label, index) => (
        <label key={label} className="cp-channel">
          <input
            aria-label={label}
            inputMode="numeric"
            maxLength={3}
            value={drafts[index] ?? String(values[index])}
            onChange={(event) => setDrafts({ ...drafts, [index]: event.target.value.replace(/\D/g, '') })}
            onBlur={() => commit(index)}
            onKeyDown={onKeyDown(index)}
          />
          <span aria-hidden>{label}</span>
        </label>
      ))}
    </div>
  );
}
