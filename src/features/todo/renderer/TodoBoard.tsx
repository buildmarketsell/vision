import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { TODO_COLUMNS, type TodoItem, type TodoStatus } from '../../../shared/todos';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { FocusChip, useFocusPicker } from '../../../renderer/components/FocusPicker';
import { AddTodo, openMenuAt, StatusTag, TodoText, todoMenu, type MenuState } from './TodoParts';
import type { RunTodo } from './todoStore';
import type { PlanState } from '../../../shared/plan';
import { usePlan } from '../../../renderer/core/usePlan';
import { PlanChips, usePlanEditor } from './TodoPlan';

type Schedule = (todo: TodoItem, x: number, y: number) => void;

const DRAG_TYPE = 'application/x-vision-todo';

function Card({ todo, run, onMenu, editing, setEditing, plan, onSchedule }: {
  todo: TodoItem;
  run: RunTodo;
  plan: PlanState | null;
  onSchedule: Schedule;
  onMenu: (menu: MenuState) => void;
  editing: boolean;
  setEditing: (id: string | null) => void;
}) {
  return (
    <li
      className="todo-card enter"
      tabIndex={0}
      draggable={!editing}
      aria-label={todo.text}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, todo.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDoubleClick={() => setEditing(todo.id)}
      onKeyDown={(event) => event.key === 'Enter' && !editing && setEditing(todo.id)}
      onContextMenu={(event) => openMenuAt(event, todo, onMenu)}
    >
      <TodoText todo={todo} editing={editing} onStop={() => setEditing(null)} run={run} />
      <FocusChip todoId={todo.id} />
      <PlanChips todo={todo} plan={plan} onEdit={(x, y) => onSchedule(todo, x, y)} />
    </li>
  );
}

function Column({ status, label, todos, run, onMenu, editing, setEditing, plan, onSchedule }: {
  status: TodoStatus;
  label: string;
  todos: TodoItem[];
  run: RunTodo;
  plan: PlanState | null;
  onSchedule: Schedule;
  onMenu: (menu: MenuState) => void;
  editing: string | null;
  setEditing: (id: string | null) => void;
}) {
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    setOver(true);
  };
  const onDrop = (event: DragEvent) => {
    setOver(false);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id && !todos.some((todo) => todo.id === id)) run(window.vision.todos.update(id, { status }));
  };
  return (
    <section className="todo-column" data-status={status} data-over={over} aria-label={label} onDragOver={onDragOver} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <header className="todo-column-header">
        <StatusTag status={status} />
        <span className="todo-count">{todos.length}</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {todos.map((todo) => (
          <Card key={todo.id} todo={todo} run={run} onMenu={onMenu} editing={editing === todo.id} setEditing={setEditing} plan={plan} onSchedule={onSchedule} />
        ))}
      </ul>
      {adding ? (
        <AddTodo status={status} run={run} placeholder="Type a name, then Enter" autoFocus onDone={() => setAdding(false)} />
      ) : (
        <button className="todo-new" onClick={() => setAdding(true)}>
          <Plus size={14} strokeWidth={1.75} /> New
        </button>
      )}
    </section>
  );
}

/** Kanban board: one column per status; drag a card to move it, right-click for more. */
export function TodoBoard({ todos, run }: { todos: TodoItem[]; run: RunTodo }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const plan = usePlan();
  const planEditor = usePlanEditor(run);
  const focusPicker = useFocusPicker();
  return (
    <div className="todo-board page-wide">
      {TODO_COLUMNS.map((column) => (
        <Column
          key={column.status}
          status={column.status}
          label={column.label}
          todos={todos.filter((todo) => todo.status === column.status)}
          run={run}
          onMenu={setMenu}
          editing={editing}
          setEditing={setEditing}
          plan={plan}
          onSchedule={planEditor.open}
        />
      ))}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={todoMenu(menu.todo, run, () => setEditing(menu.todo.id), () => planEditor.open(menu.todo, menu.x, menu.y), () => focusPicker.open(menu.todo.id, menu.todo.text, menu.x, menu.y))} onClose={() => setMenu(null)} />}
      {planEditor.editor}
      {focusPicker.picker}
    </div>
  );
}
