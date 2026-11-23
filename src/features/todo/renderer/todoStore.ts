import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { TodoItem, TodoStatus } from '../../../shared/todos';

export type TodoLayout = 'list' | 'board';
const LAYOUT_KEY = 'vision.todoLayout';
export const TODO_TAB = 'todo';
export const TODO_PANEL_ID = 'todo:page';

function readLayout(): TodoLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

/** List or board, remembered across launches. */
export const useTodoLayout = create<{ layout: TodoLayout; setLayout: (layout: TodoLayout) => void }>((set) => ({
  layout: readLayout(),
  setLayout: (layout) => {
    set({ layout });
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {
      // Not remembering the choice is fine; the view still switches.
    }
  },
}));

/** Which column is taking a new to-do (the page's New button, a column's + or New), or null. */
export const useTodoAdding = create<{ adding: TodoStatus | null; setAdding: (adding: TodoStatus | null) => void }>((set) => ({
  adding: null,
  setAdding: (adding) => set({ adding }),
}));

/** The saved to-dos, kept in sync with every window. Null while loading. */
export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    window.vision.todos.list().then(setTodos, () => setError('Could not load your to-dos.'));
    return window.vision.todos.onChange(setTodos);
  }, []);
  const run = (action: Promise<TodoItem[]>) => {
    setError(null);
    action.then(setTodos, () => setError('That did not save. Try again.'));
  };
  return { todos, error, run };
}

export type RunTodo = (action: Promise<TodoItem[]>) => void;
