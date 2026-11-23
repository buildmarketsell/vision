import { useState } from 'react';
import { useNow } from '../../../../renderer/core/useNow';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { Todo } from '../../../../shared/chat/chatTypes';

/** Playful verbs for the working line, one picked per turn, the way Claude Code does it. */
const WORKING_VERBS = [
  'Thinking', 'Pondering', 'Brewing', 'Cooking', 'Tinkering', 'Mulling', 'Noodling', 'Percolating',
  'Discombobulating', 'Conjuring', 'Untangling', 'Simmering', 'Puzzling', 'Crafting', 'Wrangling', 'Musing',
];

/** Claude Code's working line: a twinkling orange star, a verb and how long it has been going. */
export function WorkingLine() {
  const [verb] = useState(() => WORKING_VERBS[Math.floor(Math.random() * WORKING_VERBS.length)] ?? 'Thinking');
  const [startedAt] = useState(Date.now);
  const seconds = Math.floor((useNow(1000) - startedAt) / 1000);
  return (
    <div className="working-line enter" role="status" aria-live="polite">
      <span className="working-star" aria-hidden />
      <span className="working-verb">{verb}…</span>
      {seconds > 0 && <span className="working-time">{seconds}s</span>}
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
