import { useState } from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { Todo } from './chatTypes';
import { WaveText } from './WaveText';

/** The dark "working" card from the clonk reference: what Claude is doing right now. */
export function LiveCard({ activity }: { activity: string }) {
  return (
    <div className="live-card enter" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="live-dot" data-busy="true" />
        <span className="live-label">WORKING</span>
        <span className="flex-1" />
        <span className="live-label" style={{ color: 'var(--color-accent)' }}>LIVE</span>
      </div>
      <div className="live-text">
        <WaveText text={activity || 'Working…'} />
      </div>
    </div>
  );
}

/** "Tasks 2/4" with a progress bar; tap to see the checklist. */
export function TasksCard({ todos }: { todos: Todo[] }) {
  const [open, setOpen] = useState(false);
  const done = todos.filter((todo) => todo.status === 'completed').length;
  const current = todos.find((todo) => todo.status === 'in_progress');
  return (
    <div className="tasks-card">
      <button className="flex w-full items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="caption flex-1 truncate">{current?.activeForm ?? current?.content ?? 'Tasks'}</span>
        <span className="font-medium">Tasks {done}/{todos.length}</span>
        <ChevronRight className="chevron" size={13} strokeWidth={1.75} style={{ transform: open ? 'rotate(90deg)' : undefined }} />
      </button>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={todos.length} aria-valuenow={done}>
        <div style={{ transform: `scaleX(${todos.length ? done / todos.length : 0})` }} />
      </div>
      {open && (
        <ul className="enter flex flex-col gap-1 pt-1">
          {todos.map((todo) => (
            <li key={todo.content} className="flex items-center gap-2" style={{ opacity: todo.status === 'completed' ? 0.55 : 1 }}>
              {todo.status === 'completed' ? <Check size={13} color="var(--color-success)" /> : <Circle size={11} color={todo.status === 'in_progress' ? 'var(--color-accent)' : 'var(--color-text-faint)'} />}
              <span className={todo.status === 'completed' ? 'line-through' : ''}>{todo.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
