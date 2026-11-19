import { SquareKanban, ListChecks, SquareCheckBig } from 'lucide-react';
import { TodoBoard } from './TodoBoard';
import { TodoList } from './TodoList';
import { useTodoLayout, useTodos, type TodoLayout } from './todoStore';
import './todo.css';

const LAYOUTS: { value: TodoLayout; label: string; icon: typeof ListChecks }[] = [
  { value: 'list', label: 'List', icon: ListChecks },
  { value: 'board', label: 'Board', icon: SquareKanban },
];

export function LayoutSwitch() {
  const { layout, setLayout } = useTodoLayout();
  return (
    <div className="segmented" role="radiogroup" aria-label="To-do view">
      {LAYOUTS.map(({ value, label, icon: Icon }) => (
        <button key={value} role="radio" aria-checked={layout === value} data-active={layout === value} onClick={() => setLayout(value)}>
          <Icon size={13} strokeWidth={1.75} /> {label}
        </button>
      ))}
    </div>
  );
}

/** The To-do page: a Notion-style title, then the checklist or the board. */
export function TodoPanel() {
  const { todos, error, run } = useTodos();
  const layout = useTodoLayout((state) => state.layout);
  const open = todos?.filter((todo) => todo.status !== 'done').length ?? 0;
  return (
    <div className="todo-page">
      <div className="todo-page-head" data-layout={layout}>
        <SquareCheckBig size={30} strokeWidth={1.5} className="todo-page-icon" aria-hidden />
        <h1 className="todo-page-title">To-do</h1>
        <div className="flex items-center gap-3">
          <LayoutSwitch />
          <span className="caption">{open === 1 ? '1 open' : `${open} open`}</span>
        </div>
      </div>
      {error && <div className="todo-error" role="alert">{error}</div>}
      {todos === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading to-dos" />}
      {todos && (layout === 'board' ? <TodoBoard todos={todos} run={run} /> : <div className="todo-page-body"><TodoList todos={todos} run={run} /></div>)}
    </div>
  );
}
