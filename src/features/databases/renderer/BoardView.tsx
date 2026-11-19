import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import type { Database, DbProperty, DbRow, SelectOption } from '../../../shared/databases';
import { addProperty, addRow, rowTitle, setCell } from '../../../shared/databaseOps';
import { CellValue, type Edit } from './Cell';
import { Tag } from './SelectMenu';
import { newId } from './dbStore';

const DRAG_TYPE = 'application/x-vision-db-row';

/** The column already says the group, so the card leaves that property out. */
function Card({ db, row, groupId, onOpen }: { db: Database; row: DbRow; groupId: string; onOpen: () => void }) {
  const shown = db.properties.slice(1).filter((property) => property.id !== groupId && property.type !== 'checkbox' && row.cells[property.id] !== undefined);
  return (
    <li
      className="db-card enter"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, row.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
    >
      <div className="db-card-title">{rowTitle(db, row) || <span className="db-placeholder">Untitled</span>}</div>
      {shown.map((property) => (
        <div key={property.id} className="db-card-prop">
          <CellValue property={property} row={row} />
        </div>
      ))}
    </li>
  );
}

function Column({ db, group, option, rows, edit, onOpen }: {
  db: Database;
  group: DbProperty;
  option: SelectOption | null;
  rows: DbRow[];
  edit: Edit;
  onOpen: (rowId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const onDrop = (event: DragEvent) => {
    setOver(false);
    const rowId = event.dataTransfer.getData(DRAG_TYPE);
    if (rowId) edit((current) => setCell(current, rowId, group.id, option?.id));
  };
  return (
    <section
      className="db-column"
      data-color={option?.color ?? 'none'}
      data-over={over}
      aria-label={option?.name ?? `No ${group.name}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <header className="db-column-header">
        {option ? <Tag option={option} /> : <span className="db-no-group">No {group.name}</span>}
        <span className="db-count">{rows.length}</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => <Card key={row.id} db={db} row={row} groupId={group.id} onOpen={() => onOpen(row.id)} />)}
      </ul>
      <button
        className="db-column-new"
        onClick={() => {
          let rowId = '';
          edit((current) => {
            const result = addRow(current, newId, Date.now(), option ? { [group.id]: option.id } : {});
            rowId = result.row.id;
            return result.db;
          });
          onOpen(rowId);
        }}
      >
        <Plus size={14} strokeWidth={1.75} /> New page
      </button>
    </section>
  );
}

/** Kanban grouped by the first Select column; columns follow that column's options. */
export function BoardView({ db, rows, edit, onOpen }: { db: Database; rows: DbRow[]; edit: Edit; onOpen: (rowId: string) => void }) {
  const group = db.properties.find((property) => property.type === 'select');
  if (!group) {
    return (
      <div className="db-board-empty">
        <p>A board groups pages by a Select property.</p>
        <button className="db-button" onClick={() => edit((current) => addProperty(current, 'select', newId).db)}>
          Add a Select property
        </button>
      </div>
    );
  }
  const known = new Set(group.options.map((option) => option.id));
  const ungrouped = rows.filter((row) => !known.has(String(row.cells[group.id])));
  return (
    <div className="db-board">
      {ungrouped.length > 0 && <Column db={db} group={group} option={null} rows={ungrouped} edit={edit} onOpen={onOpen} />}
      {group.options.map((option) => (
        <Column key={option.id} db={db} group={group} option={option} rows={rows.filter((row) => row.cells[group.id] === option.id)} edit={edit} onOpen={onOpen} />
      ))}
    </div>
  );
}
