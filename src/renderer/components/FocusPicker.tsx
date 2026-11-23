import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Timer, Watch } from 'lucide-react';
import { clockLabel, DEFAULT_FOCUS_MINUTES, FOCUS_LENGTHS, focusedMs, MAX_FOCUS_MINUTES, remainingMs } from '../../shared/focus';
import { followFocus, startFocus, useFocusStore } from '../core/focus';
import { useNow } from '../core/useNow';

const WIDTH = 280;
const HEIGHT = 210;

/** How long to focus on a to-do: 15 / 25 / 50, any length, or a stopwatch. Enter starts 25 minutes. */
function Picker({ todoId, title, onClose }: { todoId: string | null; title: string; onClose: () => void }) {
  const [custom, setCustom] = useState('');
  const go = (minutes: number | null) => {
    void startFocus(todoId, minutes);
    onClose();
  };
  const customMinutes = Number(custom);
  const customValid = Number.isInteger(customMinutes) && customMinutes >= 1 && customMinutes <= MAX_FOCUS_MINUTES;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (custom && !customValid) return;
    go(custom ? customMinutes : DEFAULT_FOCUS_MINUTES);
  };
  return (
    <form className="focus-picker" aria-label="Start a focus" onSubmit={submit} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="focus-picker-head">
        <Timer size={15} strokeWidth={1.75} />
        <span className="focus-picker-title">{title}</span>
      </div>
      <div className="focus-picker-lengths" role="group" aria-label="Focus length">
        {FOCUS_LENGTHS.map((minutes) => (
          <button key={minutes} type="button" className="focus-picker-length" data-default={minutes === DEFAULT_FOCUS_MINUTES} autoFocus={minutes === DEFAULT_FOCUS_MINUTES} onClick={() => go(minutes)}>
            <span className="focus-picker-number">{minutes}</span>
            <span className="caption">min</span>
          </button>
        ))}
      </div>
      <div className="focus-picker-row">
        <input
          className="todo-plan-input focus-picker-custom"
          inputMode="numeric"
          placeholder="Other length, in minutes"
          aria-label="Other length, in minutes"
          value={custom}
          aria-invalid={custom !== '' && !customValid}
          onChange={(event) => setCustom(event.target.value.replace(/\D/g, '').slice(0, 3))}
        />
        <button type="submit" className="button-primary" disabled={custom !== '' && !customValid}>Start</button>
      </div>
      <button type="button" className="focus-picker-stopwatch" onClick={() => go(null)}>
        <Watch size={14} strokeWidth={1.75} /> Stopwatch, no set length
      </button>
    </form>
  );
}

/** The focus picker for any to-do (or none): `open(todoId, title, x, y)` shows it where it was asked for. */
export function useFocusPicker(): { open: (todoId: string | null, title: string, x: number, y: number) => void; picker: ReactNode } {
  const [target, setTarget] = useState<{ todoId: string | null; title: string; left: number; top: number } | null>(null);
  const open = (todoId: string | null, title: string, x: number, y: number) =>
    setTarget({ todoId, title, left: Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8)), top: Math.max(8, Math.min(y + 8, window.innerHeight - HEIGHT - 8)) });
  const close = () => setTarget(null);
  const picker =
    target &&
    createPortal(
      <>
        <div className="todo-plan-scrim" onClick={close} aria-hidden />
        <div className="todo-plan-popover" style={{ left: target.left, top: target.top, width: WIDTH }}>
          <Picker todoId={target.todoId} title={target.title} onClose={close} />
        </div>
      </>,
      document.body,
    );
  return { open, picker };
}

/** "◉ 18:42" next to the to-do being focused on, counting live; nothing for other to-dos. */
export function FocusChip({ todoId }: { todoId: string }) {
  useEffect(followFocus, []);
  const state = useFocusStore((store) => store.view?.state);
  const focus = state?.focus?.todoId === todoId ? state.focus : null;
  const checkIn = !focus && state?.checkIn?.todoId === todoId;
  const now = useNow(focus?.runningSince ? 1_000 : 60_000);
  if (!focus && !checkIn) return null;
  const clock = focus ? clockLabel(remainingMs(focus, now) ?? focusedMs(focus, now)) : 'Done?';
  return (
    <span className="focus-chip" data-paused={focus?.runningSince === null} title={focus ? 'Focusing on this' : "This focus is over: answer in the menu bar or the island"}>
      <span className="focus-chip-dot" aria-hidden />
      {clock}
    </span>
  );
}
