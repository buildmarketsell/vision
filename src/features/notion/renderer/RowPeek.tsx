import { useEffect, useState } from 'react';
import { ChevronsRight, Trash2 } from 'lucide-react';
import type { Database, DbRow } from '../../../shared/databases';
import { removeRow, rowTitle, setCell, setNotes, titleProperty } from '../../../shared/databaseOps';
import { Cell, type Edit } from './Cell';
import { TypeIcon } from './Popover';
import { useLatest } from '../../../renderer/core/useLatest';

const NOTES_SAVE_MS = 400;

/** The notes save a moment after typing stops (so every key isn't a write), and at once on leaving the box or closing the page. */
function Notes({ row, edit }: { row: DbRow; edit: Edit }) {
  const [draft, setDraft] = useState(row.notes);
  const save = useLatest(() => edit((db) => setNotes(db, row.id, draft)));
  useEffect(() => {
    if (draft === row.notes) return;
    const timer = setTimeout(() => save.current(), NOTES_SAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, row.notes, save]);
  useEffect(() => () => save.current(), [save]);
  return (
    <textarea
      className="db-notes"
      value={draft}
      placeholder="Write something…"
      aria-label="Page notes"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => save.current()}
    />
  );
}

function Title({ db, row, edit }: { db: Database; row: DbRow; edit: Edit }) {
  const [draft, setDraft] = useState(rowTitle(db, row));
  const save = () => draft !== rowTitle(db, row) && edit((current) => setCell(current, row.id, titleProperty(current).id, draft.trim()));
  return (
    <input
      className="db-peek-title"
      value={draft}
      placeholder="Untitled"
      aria-label="Page title"
      autoFocus={!draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
    />
  );
}

/** A row opened as a page on the right side, like Notion's side peek. */
export function RowPeek({ db, row, edit, onClose }: { db: Database; row: DbRow; edit: Edit; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && !(event.target instanceof HTMLInputElement) && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <aside className="db-peek" aria-label="Page">
      <div className="db-peek-bar">
        <button className="icon-button" title="Close" aria-label="Close" onClick={onClose}>
          <ChevronsRight size={16} strokeWidth={1.75} />
        </button>
        <button
          className="icon-button"
          title="Delete page"
          aria-label="Delete page"
          onClick={() => {
            edit((current) => removeRow(current, row.id));
            onClose();
          }}
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="db-peek-body">
        <Title key={row.id} db={db} row={row} edit={edit} />
        <div className="db-props">
          {db.properties.slice(1).map((property) => (
            <div key={property.id} className="db-prop-row">
              <div className="db-prop-name">
                <TypeIcon type={property.type} />
                <span className="truncate">{property.name}</span>
              </div>
              <Cell db={db} row={row} property={property} edit={edit} className="db-prop-value" />
            </div>
          ))}
        </div>
        <div className="db-menu-divider" />
        <Notes key={row.id} row={row} edit={edit} />
      </div>
    </aside>
  );
}
