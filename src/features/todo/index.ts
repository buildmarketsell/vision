import { createElement } from 'react';
import { SquareCheckBig } from 'lucide-react';
import type { Feature } from '../../renderer/core/feature';
import { TodoPanel } from './renderer/TodoPanel';
import { TODO_TAB } from './renderer/todoStore';
import { todoSearchProvider } from './renderer/todoSearchProvider';
import { TodoCard } from './renderer/TodoCard';

const icon = () => createElement(SquareCheckBig, { size: 15, strokeWidth: 1.5 });

export const todoFeature: Feature = {
  id: 'todo',
  name: 'To-do',
  sidebarViews: [{ id: 'todo', title: 'To-do', icon: icon(), main: TodoPanel }],
  searchProviders: [todoSearchProvider],
  dashboardCards: [{ id: 'todos', title: 'To-do', icon: icon(), component: TodoCard, view: 'todo' }],
  // Kept so To-do tabs saved in a layout still restore.
  tabTypes: [{ id: TODO_TAB, component: TodoPanel, closable: true, icon }],
};
