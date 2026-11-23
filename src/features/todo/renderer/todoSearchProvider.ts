import { createElement } from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import type { SearchProvider } from '../../../renderer/core/feature';
import { useActiveViewStore } from '../../../renderer/core/activeView';
import { rankItems } from '../../../shared/palette';

/** To-dos by their text; open ones first. Picking one opens the To-do page. */
export const todoSearchProvider: SearchProvider = {
  id: 'todos',
  title: 'To-dos',
  search: async (query) => {
    const todos = await window.vision.todos.list();
    const named = todos.map((todo) => ({ todo, title: todo.text }));
    const ranked = rankItems(named, query);
    const open = ranked.filter(({ todo }) => todo.status !== 'done');
    const done = ranked.filter(({ todo }) => todo.status === 'done');
    return [...open, ...done].map(({ todo, title }) => ({
      id: `todo:${todo.id}`,
      title,
      detail: todo.status === 'done' ? 'Done' : undefined,
      kind: 'To-do',
      icon: createElement(todo.status === 'done' ? CircleCheck : Circle, { size: 15, strokeWidth: 1.5 }),
      run: () => useActiveViewStore.getState().select('todo'),
    }));
  },
};
