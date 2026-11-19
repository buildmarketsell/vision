import { useState } from 'react';
import { Plus, Table2, Trash2, PanelRightOpen } from 'lucide-react';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import type { Database } from '../../../shared/databases';
import { openDatabase, useDatabaseList } from './dbStore';
import './databases.css';

const ICON = { size: 15, strokeWidth: 1.5 };

/** Sidebar view: every database, newest last; click to open its page, right-click to delete. */
export function DatabasesView() {
  const { databases, error, create, remove } = useDatabaseList();
  const [menu, setMenu] = useState<{ x: number; y: number; db: Database } | null>(null);
  const createAndOpen = () => openDatabase(create());
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-2">
        <div className="section-label">Databases</div>
        <button className="icon-button" title="New database" aria-label="New database" onClick={createAndOpen}>
          <Plus {...ICON} />
        </button>
      </div>
      {error && <div className="db-error" role="alert">{error}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {databases === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading databases" />}
        {databases?.length === 0 && (
          <button className="row w-full db-sidebar-empty" onClick={createAndOpen}>
            <Plus {...ICON} /> New database
          </button>
        )}
        {databases?.map((db) => (
          <button
            key={db.id}
            className="row w-full"
            onClick={() => openDatabase(db)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ x: event.clientX, y: event.clientY, db });
            }}
          >
            <Table2 {...ICON} className="shrink-0" />
            <span className="truncate">{db.name || 'Untitled'}</span>
            <span className="db-sidebar-count">{db.rows.length}</span>
          </button>
        ))}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Open', icon: <PanelRightOpen {...ICON} />, onSelect: () => openDatabase(menu.db) },
            { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => remove(menu.db.id) },
          ]}
        />
      )}
    </div>
  );
}
