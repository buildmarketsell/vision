import { useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CHUNKS, DURATIONS, durationLabel, HOURS_NAMES, PRIORITIES, type PlanState, type TodoPlan } from '../../../shared/plan';
import type { TodoItem } from '../../../shared/todos';
import { shortWhen } from '../../../renderer/core/usePlan';
import type { RunTodo } from './todoStore';

const WIDTH = 320;
const HEIGHT = 420;
const NEW_PLAN: TodoPlan = { minutes: 60, priority: 'medium', hours: 'personal', deadline: null, hardDeadline: false, minChunk: 30 };

const pad = (value: number) => String(value).padStart(2, '0');
const dateInput = (ms: number | null) => {
  if (ms === null) return '';
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
/** A deadline picked as a date means the end of that day. */
const endOfDay = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 23, 59).getTime();
};
const dueLabel = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} data-active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Duration, priority, hours, deadline: what the Calendar needs to plan this to-do. */
function PlanForm({ todo, run, onClose }: { todo: TodoItem; run: RunTodo; onClose: () => void }) {
  const [plan, setPlan] = useState<TodoPlan>(todo.plan ?? NEW_PLAN);
  const set = (change: Partial<TodoPlan>) => setPlan({ ...plan, ...change });
  const save = (event: FormEvent) => {
    event.preventDefault();
    run(window.vision.todos.update(todo.id, { plan: { ...plan, hardDeadline: plan.deadline !== null && plan.hardDeadline } }));
    onClose();
  };
  return (
    <form className="todo-plan-form" aria-label="Schedule to-do" onSubmit={save} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="todo-plan-name">{todo.text}</div>
      <label className="todo-plan-field">
        <span className="caption">How long</span>
        <select className="todo-plan-input" value={plan.minutes} aria-label="How long" autoFocus onChange={(event) => set({ minutes: Number(event.target.value) })}>
          {[...new Set([...DURATIONS, plan.minutes])].sort((a, b) => a - b).map((minutes) => (
            <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>
          ))}
        </select>
      </label>
      <div className="todo-plan-field">
        <span className="caption">Priority</span>
        <Choice label="Priority" value={plan.priority} options={PRIORITIES} onChange={(priority) => set({ priority })} />
      </div>
      <div className="todo-plan-field">
        <span className="caption">When</span>
        <Choice label="Hours" value={plan.hours} options={HOURS_NAMES} onChange={(hours) => set({ hours })} />
      </div>
      <label className="todo-plan-field">
        <span className="caption">Deadline (optional)</span>
        <input className="todo-plan-input" type="date" value={dateInput(plan.deadline)} aria-label="Deadline" onChange={(event) => set({ deadline: event.target.value ? endOfDay(event.target.value) : null })} />
      </label>
      <label className="todo-plan-check" data-disabled={plan.deadline === null}>
        <input type="checkbox" checked={plan.hardDeadline && plan.deadline !== null} disabled={plan.deadline === null} onChange={(event) => set({ hardDeadline: event.target.checked })} />
        Hard deadline: it must be done by then
      </label>
      <label className="todo-plan-field">
        <span className="caption">Split into pieces of at least</span>
        <select className="todo-plan-input" value={plan.minChunk} aria-label="Split into pieces of at least" onChange={(event) => set({ minChunk: Number(event.target.value) })}>
          {CHUNKS.map((chunk) => (
            <option key={chunk.value} value={chunk.value}>{chunk.label}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        {todo.plan && (
          <button type="button" className="button-secondary" onClick={() => { run(window.vision.todos.update(todo.id, { plan: null })); onClose(); }}>
            Unschedule
          </button>
        )}
        <span className="flex-1" />
        <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button-primary">Schedule</button>
      </div>
    </form>
  );
}

/** The schedule popover for any to-do: `open(todo, x, y)` shows it where it was asked for. */
export function usePlanEditor(run: RunTodo): { open: (todo: TodoItem, x: number, y: number) => void; editor: ReactNode } {
  const [target, setTarget] = useState<{ todo: TodoItem; left: number; top: number } | null>(null);
  const open = (todo: TodoItem, x: number, y: number) =>
    setTarget({ todo, left: Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8)), top: Math.max(8, Math.min(y + 8, window.innerHeight - HEIGHT - 8)) });
  const close = () => setTarget(null);
  const editor =
    target &&
    createPortal(
      <>
        <div className="todo-plan-scrim" onClick={close} aria-hidden />
        <div className="todo-plan-popover" style={{ left: target.left, top: target.top, width: WIDTH }}>
          <PlanForm todo={target.todo} run={run} onClose={close} />
        </div>
      </>,
      document.body,
    );
  return { open, editor };
}

/** Motion-style line under a to-do: how long, when it's planned, the deadline, or that it's at risk. */
export function PlanChips({ todo, plan, onEdit }: { todo: TodoItem; plan: PlanState | null; onEdit: (x: number, y: number) => void }) {
  if (!todo.plan || todo.status === 'done') return null;
  // Blocks are sorted and every one ended after the plan was made, so the first is the next (or current) one.
  const next = plan?.blocks.find((block) => block.taskId === todo.id);
  const atRisk = plan?.risks.some((risk) => risk.taskId === todo.id) ?? false;
  const priority = PRIORITIES.find((item) => item.value === todo.plan?.priority);
  return (
    <button className="todo-plan-chips" aria-label={`Schedule of "${todo.text}"`} onClick={(event) => onEdit(event.clientX, event.clientY)}>
      <span className="todo-tag">{durationLabel(todo.plan.minutes)}</span>
      {todo.plan.priority !== 'medium' && <span className="todo-tag" data-priority={todo.plan.priority}>{priority?.label}</span>}
      {todo.plan.deadline !== null && <span className="todo-tag" data-hard={todo.plan.hardDeadline}>Due {dueLabel(todo.plan.deadline)}</span>}
      {atRisk ? <span className="todo-tag" data-risk>At risk</span> : next ? <span className="todo-plan-when">{shortWhen(next.start)}</span> : plan?.plannedAt ? null : <span className="todo-plan-when">Planning…</span>}
    </button>
  );
}
