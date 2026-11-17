import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { EFFORT_LEVELS, type EffortLevel } from '../../../../shared/claudeChat';
import { ComposerMenu } from './ComposerMenu';
import type { ModelOption, SessionInfo } from './sessionInfo';

const RING_SIZE = 16;
const RING_STROKE = 2;
/** Above this share of the context window the meter turns red: Claude will compact soon. */
const CONTEXT_WARNING = 0.8;
/** Below this share the meter stays hidden, like VS Code: a fresh session already uses ~20% (Dan, 2026-11-17). */
const CONTEXT_SHOW = 0.5;
const EFFORT_LABELS: Record<EffortLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra', max: 'Max' };

/** Closes a popover on a click outside it or on Escape. */
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}

export function modelLabel(models: ModelOption[], value: string): string {
  const found = models.find((model) => model.value === value);
  if (!found) return value === 'default' ? 'Default model' : value;
  return found.value === 'default' ? 'Default model' : found.displayName;
}

interface ModelPickerProps {
  models: ModelOption[];
  value: string;
  onChange: (model: string) => void;
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
}

/** Effort steps under the model list, like VS Code's picker. Applies to the running chat at once. */
function EffortControl({ effort, onChange }: { effort: EffortLevel; onChange: (effort: EffortLevel) => void }) {
  return (
    <div className="composer-menu-footer">
      <span>Effort</span>
      <div className="segmented" role="radiogroup" aria-label="Effort">
        {EFFORT_LEVELS.map((level) => (
          <button key={level} role="radio" aria-checked={level === effort} data-active={level === effort} onClick={() => level !== effort && onChange(level)}>
            {EFFORT_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModelPicker({ models, value, onChange, effort, onEffortChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  if (models.length === 0) return null;
  const items = models.map((model) => ({ id: model.value, label: model.displayName, detail: model.description, selected: model.value === value }));
  const supportsEffort = models.find((model) => model.value === value)?.supportsEffort === true;
  return (
    <div ref={ref} className="relative">
      <button className="composer-pill" aria-haspopup="listbox" aria-expanded={open} title="Model" onClick={() => setOpen(!open)}>
        {modelLabel(models, value)}
        {supportsEffort && <span className="composer-pill-detail">{EFFORT_LABELS[effort]}</span>}
        <ChevronDown size={12} strokeWidth={2} className="chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ComposerMenu
          label="Model"
          items={items}
          activeIndex={active}
          onHover={setActive}
          footer={supportsEffort && <EffortControl effort={effort} onChange={onEffortChange} />}
          onPick={(item) => {
            setOpen(false);
            if (item.id !== value) onChange(item.id);
          }}
        />
      )}
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}

/** Kokonut's context meter: a small ring, with the numbers on click. */
export function ContextMeter({ info }: { info: SessionInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const share = Math.min(1, info.contextUsed / info.contextWindow);
  if (share < CONTEXT_SHOW) return null;
  const percent = Math.round(share * 100);
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const high = share >= CONTEXT_WARNING;
  const summary = `${formatTokens(info.contextUsed)} of ${formatTokens(info.contextWindow)} tokens`;
  return (
    <div ref={ref} className="relative">
      <button className="composer-pill" aria-label={`Context ${percent}% used`} title="Context window" onClick={() => setOpen(!open)}>
        <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" strokeWidth={RING_STROKE} stroke="var(--color-row-selected)" />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            stroke={high ? 'var(--color-danger)' : 'var(--color-text-muted)'}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share)}
          />
        </svg>
        {percent}%
      </button>
      {open && (
        <div className="composer-menu menu p-3" role="dialog" aria-label="Context window" style={{ width: 240, left: 'auto', right: 0, transformOrigin: 'bottom right' }}>
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Context window</span>
            <span className="caption tabular-nums">{percent}%</span>
          </div>
          <div className="progress mt-2">
            <div style={{ transform: `scaleX(${share})`, background: high ? 'var(--color-danger)' : undefined }} />
          </div>
          <div className="caption mt-2 tabular-nums">{summary}</div>
          <div className="caption mt-1">When it fills up, Claude Code compacts older messages. Type /compact to do it now.</div>
        </div>
      )}
    </div>
  );
}
