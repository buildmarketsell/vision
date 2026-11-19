import { SquareKanban, ListChecks } from 'lucide-react';
import { openPageTab } from '../../../renderer/core/dockActions';
import { TodoList } from './TodoList';
import { TODO_PANEL_ID, TODO_TAB, useTodoLayout, useTodos, type TodoLayout } from './todoStore';
import './todo.css';

function openPage(layout: TodoLayout): void {
  useTodoLayout.getState().setLayout(layout);
  openPageTab(TODO_PANEL_ID, TODO_TAB, 'To-do');
}

/** Sidebar view: the checklist, plus buttons that open it as a full page in list or board view. */
export function TodoView() {
  const { todos, error, run } = useTodos();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">To-do</div>
        <div className="flex items-center">
          <button className="icon-button" title="Open as a list page" aria-label="Open as a list page" onClick={() => openPage('list')}>
            <ListChecks size={15} strokeWidth={1.5} />
          </button>
          <button className="icon-button" title="Open as a board" aria-label="Open as a board" onClick={() => openPage('board')}>
            <SquareKanban size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {error && <div className="todo-error" role="alert">{error}</div>}
      <div className="todo-sidebar min-h-0 flex-1 overflow-y-auto">
        {todos === null && !error ? <div className="spinner mx-auto mt-6" aria-label="Loading to-dos" /> : <TodoList todos={todos ?? []} run={run} />}
      </div>
    </div>
  );
}
