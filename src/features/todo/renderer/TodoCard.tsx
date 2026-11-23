import { Circle, CircleDot } from 'lucide-react';
import { useTodos } from './todoStore';

const SHOWN = 8;

/** Dashboard card: open to-dos, in progress first; tick one off right here. */
export function TodoCard() {
  const { todos, run } = useTodos();
  if (!todos) return <div className="caption">Loading…</div>;
  const open = todos.filter((todo) => todo.status !== 'done').sort((a, b) => (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1));
  if (open.length === 0) return <div className="caption">All done.</div>;
  return (
    <div>
      {open.slice(0, SHOWN).map((todo) => (
        <div key={todo.id} className="dash-row">
          <button className="icon-button" aria-label={`Mark "${todo.text}" done`} onClick={() => run(window.vision.todos.update(todo.id, { status: 'done' }))}>
            {todo.status === 'doing' ? <CircleDot size={16} strokeWidth={1.5} /> : <Circle size={16} strokeWidth={1.5} />}
          </button>
          <span className="min-w-0 flex-1 truncate">{todo.text}</span>
        </div>
      ))}
      {open.length > SHOWN && <div className="caption">+{open.length - SHOWN} more</div>}
    </div>
  );
}
