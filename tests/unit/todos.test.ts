import { describe, expect, it } from 'vitest';
import { applyTodoChange, cleanTodoText, normalizeTodos, type TodoItem } from '../../src/shared/todos';

const todo = (id: string, status: TodoItem['status'] = 'todo'): TodoItem => ({ id, text: id, status, createdAt: 1 });

describe('to-dos', () => {
  it('keeps well-formed items from the saved file and fixes unknown statuses', () => {
    expect(normalizeTodos([{ id: 'a', text: 'A', status: 'weird', createdAt: 1 }, { id: 'b' }, 'junk'])).toEqual([
      { id: 'a', text: 'A', status: 'todo', createdAt: 1 },
    ]);
    expect(normalizeTodos({ not: 'a list' })).toEqual([]);
  });

  it('moves a to-do that changes column to the end, and edits in place otherwise', () => {
    const list = [todo('a'), todo('b'), todo('c')];
    expect(applyTodoChange(list, 'a', { status: 'doing' }).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(applyTodoChange(list, 'b', { text: '  New   text ' })[1]).toMatchObject({ id: 'b', text: 'New text' });
  });

  it('ignores empty text and unknown ids', () => {
    const list = [todo('a')];
    expect(applyTodoChange(list, 'a', { text: '   ' })).toBe(list);
    expect(applyTodoChange(list, 'zzz', { status: 'done' })).toBe(list);
    expect(cleanTodoText(42)).toBeNull();
  });
});
