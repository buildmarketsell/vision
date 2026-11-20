import { useRef, useState, type CSSProperties } from 'react';
import { Pipette } from 'lucide-react';
import { hexToHsv, hsvToHex, type Hsv } from '../colorMath';
import { ColorArea, HueSlider } from './ColorDrag';
import { ChannelFields, FORMATS, HexField, type ColorFormat } from './ColorFields';

/** Chromium's screen color sampler (Electron has it); missing from TypeScript's DOM types. */
interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}
declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperApi;
  }
}

interface ColorPickerProps {
  /** #rrggbb when the picker opens. */
  initial: string;
  /** `final` false while dragging (a live preview); true once settled (one undo step). */
  onPick: (hex: string, final: boolean) => void;
}

/**
 * The picker panel, after beui's motion color picker: saturation × brightness square, eyedropper and hue
 * slider, then hex or RGB/HSL fields. Hue is kept here so it survives grays and black.
 */
export function ColorPicker({ initial, onPick }: ColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initial));
  const [format, setFormat] = useState<ColorFormat>('hex');
  const committed = useRef(initial);
  const hex = hsvToHex(hsv);

  const preview = (next: Hsv) => {
    setHsv(next);
    onPick(hsvToHex(next), false);
  };
  const commit = (value = hex) => {
    if (value === committed.current) return;
    committed.current = value;
    onPick(value, true);
  };
  const commitHex = (value: string) => {
    // A typed or sampled color keeps the current hue when it has none (gray), so the slider doesn't jump.
    const next = hexToHsv(value);
    setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
    commit(value);
  };
  const sample = async () => {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      commitHex(sRGBHex.toLowerCase());
    } catch {
      // Escape cancels the sampler; nothing to do.
    }
  };

  return (
    <div className="cp-panel">
      <div className="cp-row" style={{ '--cp-i': 0 } as CSSProperties}>
        <ColorArea hue={hsv.h} saturation={hsv.s} brightness={hsv.v} color={hex} onChange={(s, v) => preview({ ...hsv, s, v })} onCommit={() => commit()} />
      </div>
      <div className="cp-row cp-line" style={{ '--cp-i': 1 } as CSSProperties}>
        {window.EyeDropper && (
          <button className="cp-button" aria-label="Pick a color from the screen" title="Pick from screen" onClick={() => void sample()}>
            <Pipette size={16} strokeWidth={1.75} aria-hidden />
          </button>
        )}
        <HueSlider hue={hsv.h} onChange={(h) => preview({ ...hsv, h })} onCommit={() => commit()} />
      </div>
      <div className="cp-row cp-line" style={{ '--cp-i': 2 } as CSSProperties}>
        <button
          className="cp-button cp-format"
          aria-label={`Color format: ${format.toUpperCase()}. Switch format`}
          onClick={() => setFormat(FORMATS[(FORMATS.indexOf(format) + 1) % FORMATS.length] ?? 'hex')}
        >
          <span key={format}>{format.toUpperCase()}</span>
        </button>
        {format === 'hex' ? (
          <>
            <HexField hex={hex} onChange={(value) => preview(hexToHsv(value))} onCommit={commitHex} />
            <span className="cp-swatch" style={{ background: hex }} aria-hidden />
          </>
        ) : (
          <ChannelFields format={format} hex={hex} onCommit={commitHex} />
        )}
      </div>
    </div>
  );
}
