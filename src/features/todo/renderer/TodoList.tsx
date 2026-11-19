import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { TodoItem } from '../../../shared/todos';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { AddTodo, openMenuAt, StatusTag, TodoText, todoMenu, type MenuState } from './TodoParts';
import type { RunTodo } from './todoStore';

function TodoRow({ todo, run, onMenu, editing, setEditing }: {
  todo: TodoItem;
  run: RunTodo;
  onMenu: (menu: MenuState) => void;
  editing: boolean;
  setEditing: (id: string | null) => void;
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
    </li>
  );
}

/** Checklist: open to-dos on top, done ones folded away below, like a Notion to-do page. */
export function TodoList({ todos, run }: { todos: TodoItem[]; run: RunTodo }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter((todo) => todo.status !== 'done');
  const done = todos.filter((todo) => todo.status === 'done');
  const row = (todo: TodoItem) => <TodoRow key={todo.id} todo={todo} run={run} onMenu={setMenu} editing={editing === todo.id} setEditing={setEditing} />;
  return (
    <div className="todo-list">
      <AddTodo run={run} />
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={todoMenu(menu.todo, run, () => setEditing(menu.todo.id))} onClose={() => setMenu(null)} />}
    </div>
  );
}
