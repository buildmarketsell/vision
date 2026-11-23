import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowRight, CalendarClock, Check, Pencil, Timer, Trash2 } from 'lucide-react';
import { TODO_COLUMNS, type TodoItem, type TodoStatus } from '../../../shared/todos';
import type { ContextMenuItem } from '../../../renderer/components/ContextMenu';
import type { RunTodo } from './todoStore';

const ICON = { size: 15, strokeWidth: 1.5 };

/** Notion's colored status tag. */
export function StatusTag({ status }: { status: TodoStatus }) {
  const label = TODO_COLUMNS.find((column) => column.status === status)?.label ?? status;
  return <span className="todo-tag" data-status={status}>{label}</span>;
}

/** A text box that adds a to-do on Enter and stays open for the next one. */
export function AddTodo({ status = 'todo', run, placeholder = 'Add a to-do', autoFocus = false, onDone }: {
  status?: TodoStatus;
  run: RunTodo;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [text, setText] = useState('');
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && text.trim()) {
      run(window.vision.todos.add(text, status));
      setText('');
    }
    if (event.key === 'Escape') {
      setText('');
      onDone?.();
    }
  };
  return (
    <input
      className="todo-add"
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      autoFocus={autoFocus}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => !text.trim() && onDone?.()}
    />
  );
}

/** The to-do's text, or a text box while renaming (Enter saves, Escape cancels). */
export function TodoText({ todo, editing, onStop, run }: { todo: TodoItem; editing: boolean; onStop: () => void; run: RunTodo }) {
  const [draft, setDraft] = useState(todo.text);
  if (!editing) return <span className="todo-text">{todo.text}</span>;
  const save = () => {
    if (draft.trim() && draft.trim() !== todo.text) run(window.vision.todos.update(todo.id, { text: draft }));
    onStop();
  };
  return (
    <input
      className="todo-edit"
      value={draft}
      aria-label="To-do text"
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') save();
        if (event.key === 'Escape') onStop();
      }}
    />
  );
}

/** Right-click menu: rename, schedule, focus, move to another column, delete. */
export function todoMenu(todo: TodoItem, run: RunTodo, rename: () => void, schedule: () => void, focus: () => void): ContextMenuItem[] {
  const moves = TODO_COLUMNS.filter((column) => column.status !== todo.status).map(
    (column): ContextMenuItem => ({
      label: `Move to ${column.label}`,
      icon: column.status === 'done' ? <Check {...ICON} /> : <ArrowRight {...ICON} />,
      onSelect: () => run(window.vision.todos.update(todo.id, { status: column.status })),
    }),
  );
  return [
    { label: 'Rename', icon: <Pencil {...ICON} />, onSelect: rename },
    { label: todo.plan ? 'Edit schedule' : 'Schedule…', icon: <CalendarClock {...ICON} />, onSelect: schedule },
    ...(todo.status === 'done' ? [] : [{ label: 'Focus…', icon: <Timer {...ICON} />, onSelect: focus }]),
    ...moves,
    { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => run(window.vision.todos.remove(todo.id)) },
  ];
}

export type MenuState = { x: number; y: number; todo: TodoItem } | null;

export function openMenuAt(event: MouseEvent, todo: TodoItem, setMenu: (menu: MenuState) => void): void {
  event.preventDefault();
  setMenu({ x: event.clientX, y: event.clientY, todo });
}
