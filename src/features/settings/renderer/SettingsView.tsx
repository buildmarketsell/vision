import { Check } from 'lucide-react';
import { useAppTheme } from '../../../renderer/core/appTheme';
import { useTerminalTheme, type TerminalAppearance } from '../../../renderer/core/terminalTheme';
import { THEMES, type VisionTheme } from '../../../renderer/themes';
import { ColorSettings } from './ColorSettings';
import './settings.css';

const APPEARANCES: { value: TerminalAppearance; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** Page, sidebar, text and accent: four dots that show a theme at a glance. */
function Swatch({ theme }: { theme: VisionTheme }) {
  const { card, sidebar, text, accent } = theme.colors;
  return (
    <span className="theme-swatch" aria-hidden>
      {[card, sidebar, text, accent].map((color, index) => (
        <span key={index} style={{ background: color }} />
      ))}
    </span>
  );
}

function ThemePicker() {
  const { active, setTheme } = useAppTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-0.5 px-1">
      {THEMES.map((item) => (
        <button key={item.id} role="radio" aria-checked={item.id === active.id} className="theme-row" onClick={(event) => setTheme(item.id, { x: event.clientX, y: event.clientY })}>
          <Swatch theme={item} />
          <span className="flex-1 truncate text-left">{item.name}</span>
          {item.id === active.id && <Check size={14} strokeWidth={2} color="var(--color-accent)" />}
        </button>
      ))}
    </div>
  );
}

/** Settings in the sidebar. New settings and app features get their own section here. */
export function SettingsView() {
  const { appearance, setAppearance } = useTerminalTheme();
  return (
    <div className="flex flex-col">
      <div className="section-label">Theme</div>
      <ThemePicker />
      <div className="section-label">Colors</div>
      <ColorSettings />
      <div className="section-label">Terminal</div>
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="flex-1">Appearance</span>
        <div className="segmented" role="radiogroup" aria-label="Terminal appearance">
          {APPEARANCES.map((option) => (
            <button key={option.value} role="radio" aria-checked={appearance === option.value} data-active={appearance === option.value} onClick={() => setAppearance(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Settings as a page: a centered column with a big title, like Notion's pages. */
export function SettingsPage() {
  return (
    <div className="page-column">
      <h1 className="page-title">Settings</h1>
      <div className="page-bleed">
        <SettingsView />
      </div>
    </div>
  );
}
