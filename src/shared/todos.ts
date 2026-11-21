/** To-dos: Dan's task list, shown as a checklist or a kanban board. Saved app-wide on this Mac, not per folder. */
import { normalizeTodoPlan, type TodoPlan } from './plan';

export type TodoStatus = 'todo' | 'doing' | 'done';

export const TODO_COLUMNS: ReadonlyArray<{ status: TodoStatus; label: string }> = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  /** Milliseconds since 1970. */
  createdAt: number;
  /** Set = the Calendar plans time for it (duration, priority, deadline). */
  plan?: TodoPlan;
}

export interface TodoChange {
  text?: string;
  status?: TodoStatus;
  /** null takes it off the calendar. */
  plan?: TodoPlan | null;
}

export const MAX_TODO_TEXT = 2_000;
export const MAX_TODOS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTodoStatus(value: unknown): value is TodoStatus {
  return TODO_COLUMNS.some((column) => column.status === value);
}

/** Keeps only well-formed to-dos from the saved file, in their saved order. */
export function normalizeTodos(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item): TodoItem[] => {
      if (!isRecord(item)) return [];
      const { id, text, status, createdAt } = item;
      if (typeof id !== 'string' || typeof text !== 'string' || typeof createdAt !== 'number') return [];
      const plan = normalizeTodoPlan(item['plan']);
      return [{ id, text: text.slice(0, MAX_TODO_TEXT), status: isTodoStatus(status) ? status : 'todo', createdAt, ...(plan ? { plan } : {}) }];
    })
    .slice(-MAX_TODOS);
}

/** The text to save, or null if there is nothing to save. */
export function cleanTodoText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed && trimmed.length <= MAX_TODO_TEXT ? trimmed : null;
}

/**
 * Applies a change. A to-do that moves to another column goes to the end of the list,
 * so it shows at the bottom of its new column.
 */
export function applyTodoChange(todos: TodoItem[], id: string, change: TodoChange): TodoItem[] {
  const current = todos.find((todo) => todo.id === id);
  if (!current) return todos;
  const text = change.text === undefined ? current.text : cleanTodoText(change.text);
  if (text === null) return todos;
  const status = change.status ?? current.status;
  const next: TodoItem = { ...current, text, status };
  if (change.plan === null) delete next.plan;
  else if (change.plan) next.plan = change.plan;
  if (status === current.status) return todos.map((todo) => (todo.id === id ? next : todo));
  return [...todos.filter((todo) => todo.id !== id), next];
}
