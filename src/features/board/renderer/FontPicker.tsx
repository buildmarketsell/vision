import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MAX_FONT_SIZE, MIN_FONT_SIZE, parseFontSize } from '../boardFonts';
import { FONTS, type BuiltInFont } from '../boardStyle';
import { useMacFonts } from './macFonts';
import './board-text.css';

export const FONT_LABELS: Record<BuiltInFont, string> = { draw: 'Hand-drawn', sans: 'Sans', mono: 'Mono' };
const BUILT_IN_CSS: Record<BuiltInFont, string> = { draw: 'Excalifont', sans: 'Nunito', mono: 'Cascadia' };

function isBuiltIn(font: string): font is BuiltInFont {
  return (FONTS as string[]).includes(font);
}
export function fontLabel(font: string): string {
  return isBuiltIn(font) ? FONT_LABELS[font] : font;
}
export function fontCss(font: string): string {
  return isBuiltIn(font) ? BUILT_IN_CSS[font] : `"${font.replace(/"/g, '')}"`;
}

/** Any font on the Mac: a searchable list, each name drawn in its own font. */
export function FontPicker({ font, onPick }: { font: string; onPick: (font: string) => void }) {
  const fonts = useMacFonts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const query = search.trim().toLowerCase();
  const options = [...FONTS, ...(fonts?.families ?? [])].filter((option) => fontLabel(option).toLowerCase().includes(query));
  const pick = (option: string) => {
    onPick(option);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={box} className="board-font-picker">
      <button className="board-font-button" aria-label="Font" aria-expanded={open} title={fontLabel(font)} onClick={() => setOpen(!open)}>
        <span className="truncate" style={{ fontFamily: fontCss(font) }}>
          {fontLabel(font)}
        </span>
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div className="board-font-list" role="dialog" aria-label="Fonts">
          <input
            autoFocus
            className="board-font-search"
            placeholder="Search fonts"
            aria-label="Search fonts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter' && options[0]) pick(options[0]);
            }}
          />
          {fonts === null && <div className="spinner mx-auto my-3" aria-label="Loading fonts" />}
          {fonts?.error && <div className="board-font-note" role="alert">{fonts.error}</div>}
          <ul role="listbox" aria-label="Fonts">
            {options.map((option) => (
              <li key={option} role="option" aria-selected={option === font}>
                <button className="board-font-option" style={{ fontFamily: fontCss(option) }} onClick={() => pick(option)}>
                  {fontLabel(option)}
                </button>
              </li>
            ))}
          </ul>
          {fonts && options.length === 0 && <div className="board-font-note">No font called “{search}”.</div>}
        </div>
      )}
    </div>
  );
}

/** Text size in pixels: type any number; Enter or leaving the field applies it, a bad number goes back. */
export function FontSizeField({ size, onChange }: { size: number; onChange: (size: number) => void }) {
  // What's being typed; null shows the current size (so picking other text updates the field).
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const value = draft === null ? null : parseFontSize(draft);
    setDraft(null);
    if (value !== null && value !== size) onChange(value);
  };
  return (
    <label className="board-size-field">
      <input
        type="number"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        aria-label="Text size in pixels"
        value={draft ?? String(size)}
        onChange={(event) => {
          setDraft(event.target.value);
          // The arrows (keyboard or spinner) apply at once; typing waits for Enter.
          if (!(event.nativeEvent instanceof InputEvent)) {
            const value = parseFontSize(event.target.value);
            setDraft(null);
            if (value !== null) onChange(value);
          }
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
      />
      <span aria-hidden>px</span>
    </label>
  );
}
