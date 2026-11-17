import { useTerminalTheme, type TerminalAppearance } from '../../../renderer/core/terminalTheme';

const APPEARANCES: { value: TerminalAppearance; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** Settings in the sidebar. New settings and app features get their own section here. */
export function SettingsView() {
  const { appearance, setAppearance } = useTerminalTheme();
  return (
    <div className="flex flex-col">
      <div className="section-label">Settings</div>
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="flex-1">Terminal</span>
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
