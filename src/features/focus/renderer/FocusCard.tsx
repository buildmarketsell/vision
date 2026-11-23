import { useEffect } from 'react';
import { Pause, Play, Square, Check, Timer } from 'lucide-react';
import { DEFAULT_FOCUS_MINUTES } from '../../../shared/focus';
import { glance } from '../../../shared/glance';
import { followFocus, startFocus, useFocusStore } from '../../../renderer/core/focus';
import { useNow } from '../../../renderer/core/useNow';

/** Dashboard card: the running focus with its clock and controls, or buttons to start one. */
export function FocusCard() {
  useEffect(followFocus, []);
  const view = useFocusStore((state) => state.view);
  const now = useNow(1000);
  if (!view) return <div className="caption">Loading…</div>;
  const current = glance(view.state, null, now);
  const act = (kind: 'pause' | 'resume' | 'stop' | 'done') => void window.vision.focus.act({ kind });
  if (current.kind === 'focus' || current.kind === 'check-in') {
    const paused = current.kind === 'focus' && current.paused;
    return (
      <div className="flex flex-col gap-3">
        <div className="dash-big">{current.kind === 'focus' ? current.clock : 'Time is up'}</div>
        <div className="truncate">{current.title}</div>
        <div className="flex flex-wrap gap-2">
          {current.kind === 'focus' && (
            <button className="button-secondary inline-flex items-center gap-1" onClick={() => act(paused ? 'resume' : 'pause')}>
              {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
            </button>
          )}
          {current.hasTodo && <button className="button-secondary inline-flex items-center gap-1" onClick={() => act('done')}><Check size={14} /> Done</button>}
          <button className="button-secondary inline-flex items-center gap-1" onClick={() => act('stop')}><Square size={12} /> Stop</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="caption">No focus running. Start one here or from a to-do.</div>
      <div className="flex flex-wrap gap-2">
        <button className="button-primary inline-flex items-center gap-1" onClick={() => void startFocus(null, DEFAULT_FOCUS_MINUTES)}><Play size={14} /> {DEFAULT_FOCUS_MINUTES} min</button>
        <button className="button-secondary inline-flex items-center gap-1" onClick={() => void startFocus(null, null)}><Timer size={14} /> Stopwatch</button>
      </div>
    </div>
  );
}
