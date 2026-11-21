import { IPC } from '../shared/ipc';
import { normalizeTodos, type TodoItem } from '../shared/todos';
import { createJsonListStore } from './jsonListStore';

/** Dan's to-dos (userData/todos.json): changed by the To-do feature, read by the Calendar's planner. */
export const todoList = createJsonListStore<TodoItem>('todos.json', normalizeTodos, IPC.todosChanged);
