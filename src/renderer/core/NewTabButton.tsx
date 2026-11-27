import { Plus } from 'lucide-react';
import { runCommand } from './commands';

/** Notion's "+" right after the last tab: opens a new Claude session, like ⌘T. */
export function NewTabButton() {
  return (
    <div className="dock-new-tab">
      <button className="icon-button" onClick={() => runCommand('claude.new')} aria-label="New tab" title="New tab (⌘T)">
        <Plus size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
