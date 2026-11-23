import { useState } from 'react';
import { CalendarClock, Check, ChevronRight, Timer } from 'lucide-react';
import type { PlanState } from '../../../shared/plan';
import type { TodoItem } from '../../../shared/todos';
import { usePlan } from '../../../renderer/core/usePlan';
import { PlanChips, usePlanEditor } from './TodoPlan';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { FocusChip, useFocusPicker } from '../../../renderer/components/FocusPicker';
import { AddTodo, openMenuAt, StatusTag, TodoText, todoMenu, type MenuState } from './TodoParts';
import { useTodoAdding, type RunTodo } from './todoStore';

function TodoRow({ todo, run, onMenu, editing, setEditing, plan, onSchedule, onFocus }: {
  todo: TodoItem;
  run: RunTodo;
  onMenu: (menu: MenuState) => void;
  editing: boolean;
  setEditing: (id: string | null) => void;
  plan: PlanState | null;
  onSchedule: (x: number, y: number) => void;
  onFocus: (x: number, y: number) => void;
}) {
  const done = todo.status === 'done';
  return (
    <li className="todo-row enter" data-done={done} onContextMenu={(event) => openMenuAt(event, todo, onMenu)} onDoubleClick={() => setEditing(todo.id)}>
      <button
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${todo.text}" as not done` : `Mark "${todo.text}" as done`}
        className="todo-check"
        onClick={() => run(window.vision.todos.update(todo.id, { status: done ? 'todo' : 'done' }))}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <TodoText todo={todo} editing={editing} onStop={() => setEditing(null)} run={run} />
      {todo.status === 'doing' && <StatusTag status="doing" />}
      <FocusChip todoId={todo.id} />
      <PlanChips todo={todo} plan={plan} onEdit={onSchedule} />
      {!todo.plan && !done && (
        <button className="todo-schedule" title="Schedule on the calendar" aria-label={`Schedule "${todo.text}"`} onClick={(event) => onSchedule(event.clientX, event.clientY)}>
          <CalendarClock size={14} strokeWidth={1.5} />
        </button>
      )}
      {!done && (
        <button className="todo-schedule" title="Focus on this" aria-label={`Focus on "${todo.text}"`} onClick={(event) => onFocus(event.clientX, event.clientY)}>
          <Timer size={14} strokeWidth={1.5} />
        </button>
      )}
    </li>
  );
}

/** Checklist: open to-dos on top, done ones folded away below, like a Notion to-do page. */
export function TodoList({ todos, run }: { todos: TodoItem[]; run: RunTodo }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const plan = usePlan();
  const planEditor = usePlanEditor(run);
  const focusPicker = useFocusPicker();
  const adding = useTodoAdding((state) => state.adding);
  const setAdding = useTodoAdding((state) => state.setAdding);
  const open = todos.filter((todo) => todo.status !== 'done');
  const done = todos.filter((todo) => todo.status === 'done');
  const row = (todo: TodoItem) => (
    <TodoRow key={todo.id} todo={todo} run={run} onMenu={setMenu} editing={editing === todo.id} setEditing={setEditing} plan={plan} onSchedule={(x, y) => planEditor.open(todo, x, y)} onFocus={(x, y) => focusPicker.open(todo.id, todo.text, x, y)} />
  );
  return (
    <div className="todo-list">
      {/* The page's New button focuses this box (a new key remounts it with the cursor in it). */}
      <AddTodo key={adding === 'todo' ? 'new' : 'idle'} run={run} autoFocus={adding === 'todo'} onDone={() => setAdding(null)} />
      <ul aria-label="To-dos">{open.map(row)}</ul>
      {open.length === 0 && <p className="todo-empty">Nothing to do. Add a to-do above.</p>}
      {done.length > 0 && (
        <>
          <button className="todo-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <ChevronRight className="chevron" size={13} strokeWidth={1.75} style={{ transform: showDone ? 'rotate(90deg)' : undefined }} />
            Done <span className="todo-count">{done.length}</span>
          </button>
          {showDone && <ul aria-label="Done">{done.map(row)}</ul>}
        </>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={todoMenu(menu.todo, run, () => setEditing(menu.todo.id), () => planEditor.open(menu.todo, menu.x, menu.y), () => focusPicker.open(menu.todo.id, menu.todo.text, menu.x, menu.y))} onClose={() => setMenu(null)} />}
      {planEditor.editor}
      {focusPicker.picker}
    </div>
  );
}
