import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC } from '../../../shared/ipc';
import { applyTodoChange, cleanTodoText, isTodoStatus, MAX_TODOS, normalizeTodos, type TodoChange, type TodoItem } from '../../../shared/todos';
import { createJsonListStore } from '../../../main/jsonListStore';

const store = createJsonListStore<TodoItem>('todos.json', normalizeTodos, IPC.todosChanged);

function toChange(value: unknown): TodoChange | null {
  if (typeof value !== 'object' || value === null) return null;
  const { text, status } = value as Record<string, unknown>;
  if (text !== undefined && typeof text !== 'string') return null;
  if (status !== undefined && !isTodoStatus(status)) return null;
  return { ...(text === undefined ? {} : { text }), ...(status === undefined ? {} : { status }) };
}

export function registerTodos(): void {
  const { load, commit } = store;
  ipcMain.handle(IPC.todosList, () => load());

  ipcMain.handle(IPC.todosAdd, (_event, text: unknown, status: unknown) => {
    const clean = cleanTodoText(text);
    if (!clean) return load();
    const todo: TodoItem = { id: randomUUID(), text: clean, status: isTodoStatus(status) ? status : 'todo', createdAt: Date.now() };
    return commit([...load(), todo].slice(-MAX_TODOS));
  });

  ipcMain.handle(IPC.todosUpdate, (_event, id: unknown, change: unknown) => {
    const valid = toChange(change);
    if (typeof id !== 'string' || !valid) return load();
    return commit(applyTodoChange(load(), id, valid));
  });

  ipcMain.handle(IPC.todosRemove, (_event, id: unknown) => {
    if (typeof id !== 'string') return load();
    return commit(load().filter((todo) => todo.id !== id));
  });
}
