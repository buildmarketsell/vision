import { Columns3, ListChecks, SquareCheckBig } from 'lucide-react';
import { TodoBoard } from './TodoBoard';
import { TodoList } from './TodoList';
import { useTodoAdding, useTodoLayout, useTodos, type TodoLayout } from './todoStore';
import './todo.css';

const LAYOUTS: { value: TodoLayout; label: string; icon: typeof ListChecks }[] = [
  { value: 'list', label: 'List', icon: ListChecks },
  { value: 'board', label: 'Board', icon: Columns3 },
];

/** Notion's view tabs: icon and name, the open one on a soft gray pill. */
export function LayoutSwitch() {
  const { layout, setLayout } = useTodoLayout();
  return (
    <div className="todo-views" role="radiogroup" aria-label="To-do view">
      {LAYOUTS.map(({ value, label, icon: Icon }) => (
        <button key={value} className="todo-view" role="radio" aria-checked={layout === value} onClick={() => setLayout(value)}>
          <Icon size={16} strokeWidth={1.5} /> {label}
        </button>
      ))}
    </div>
  );
}

/** The To-do page: a Notion-style title, then the checklist or the board. */
export function TodoPanel() {
  const { todos, error, run } = useTodos();
  const layout = useTodoLayout((state) => state.layout);
  const setAdding = useTodoAdding((state) => state.setAdding);
  const open = todos?.filter((todo) => todo.status !== 'done').length ?? 0;
  // Like Notion, New sits at the right end of whatever is below: the list's column, or the board's last column.
  const viewbar = (
    <div className="todo-viewbar">
      <LayoutSwitch />
      <span className="caption">{open === 1 ? '1 open' : `${open} open`}</span>
      <span className="flex-1" />
      <button className="todo-new-button" onClick={() => setAdding('todo')}>New</button>
    </div>
  );
  return (
    <div className="todo-page">
      <div className="todo-page-head page-column">
        <SquareCheckBig size={30} strokeWidth={1.5} className="todo-page-icon" aria-hidden />
        <h1 className="page-title">To-do</h1>
      </div>
      {error && <div className="todo-error" role="alert">{error}</div>}
      {todos === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading to-dos" />}
      {todos &&
        (layout === 'board' ? (
          <TodoBoard todos={todos} run={run} header={viewbar} />
        ) : (
          <div className="todo-page-body page-column">
            {viewbar}
            <TodoList todos={todos} run={run} />
          </div>
        ))}
    </div>
  );
}
