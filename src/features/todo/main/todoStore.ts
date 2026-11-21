import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC } from '../../../shared/ipc';
import { applyTodoChange, cleanTodoText, isTodoStatus, MAX_TODOS, type TodoChange, type TodoItem } from '../../../shared/todos';
import { todoList } from '../../../main/todoList';
import { normalizeTodoPlan } from '../../../shared/plan';


function toChange(value: unknown): TodoChange | null {
  if (typeof value !== 'object' || value === null) return null;
  const { text, status, plan } = value as Record<string, unknown>;
  if (text !== undefined && typeof text !== 'string') return null;
  if (status !== undefined && !isTodoStatus(status)) return null;
  const validPlan = plan === undefined || plan === null ? plan : normalizeTodoPlan(plan);
  if (validPlan === null && plan !== null) return null;
  return { ...(text === undefined ? {} : { text }), ...(status === undefined ? {} : { status }), ...(validPlan === undefined ? {} : { plan: validPlan }) };
}

export function registerTodos(): void {
  const { load, commit } = todoList;
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
