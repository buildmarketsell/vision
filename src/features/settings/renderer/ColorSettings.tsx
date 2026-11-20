import { Check } from 'lucide-react';
import { COLOR_PRESETS, readableOn } from '../../../shared/customColors';
import { useCustomColors } from '../../../renderer/core/customColors';

/** A row of color dots plus the Mac's own color picker. `value` null = the default (`defaultLabel`). */
function ColorRow({ label, value, defaultLabel, onChange }: { label: string; value: string | null; defaultLabel: string; onChange: (color: string | null) => void }) {
  const isCustom = value !== null && !COLOR_PRESETS.some((preset) => preset.value.toLowerCase() === value.toLowerCase());
  return (
    <div className="color-row">
      <span className="color-row-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="color-dots">
        <button role="radio" aria-checked={value === null} className="color-default" title={defaultLabel} onClick={() => onChange(null)}>
          {defaultLabel}
        </button>
        {COLOR_PRESETS.map((preset) => {
          const picked = value?.toLowerCase() === preset.value.toLowerCase();
          return (
            <button key={preset.value} role="radio" aria-checked={picked} aria-label={preset.name} title={preset.name} className="color-dot" style={{ background: preset.value, color: readableOn(preset.value) }} onClick={() => onChange(preset.value)}>
              {picked && <Check size={12} strokeWidth={3} />}
            </button>
          );
        })}
        <label className="color-dot color-custom" data-picked={isCustom} title="Any color" style={isCustom ? { background: value, color: readableOn(value) } : undefined}>
          <input type="color" aria-label={`Custom ${label.toLowerCase()} color`} value={value ?? '#F26B3A'} onChange={(event) => onChange(event.target.value)} />
          {isCustom && <Check size={12} strokeWidth={3} />}
        </label>
      </div>
    </div>
  );
}

/** Settings → Colors (Dan, 2026-11-20): the accent everywhere, and the neon light around the chat box. */
export function ColorSettings() {
  const { accent, neon, neonOn, update } = useCustomColors();
  return (
    <div className="flex flex-col gap-1 px-3">
      <ColorRow label="Accent" value={accent} defaultLabel="Theme" onChange={(color) => update({ accent: color })} />
      <ColorRow label="Neon" value={neon} defaultLabel="Accent" onChange={(color) => update({ neon: color })} />
      <div className="flex items-center gap-2 py-1">
        <span className="flex-1">Neon around the chat box</span>
        <div className="segmented" role="radiogroup" aria-label="Neon around the chat box">
          {[true, false].map((on) => (
            <button key={String(on)} role="radio" aria-checked={neonOn === on} data-active={neonOn === on} onClick={() => update({ neonOn: on })}>
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
