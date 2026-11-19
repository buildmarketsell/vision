import { useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { Database, DbProperty, DbRow, SelectOption } from '../../../shared/databases';
import { addOption, setCell } from '../../../shared/databaseOps';
import { anchorOf, Popover, type Anchor } from './Popover';
import { chosenOptions, SelectMenu, Tag } from './SelectMenu';
import { newId } from './dbStore';

export type Edit = (edit: (db: Database) => Database) => void;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (value: string): string => DATE_FORMAT.format(new Date(`${value}T00:00:00Z`));

/** What a cell shows when it isn't being edited. */
export function CellValue({ property, row }: { property: DbProperty; row: DbRow }) {
  const value = row.cells[property.id];
  if (value === undefined) return null;
  switch (property.type) {
    case 'select':
    case 'multi_select':
      return (
        <span className="db-tags">
          {chosenOptions(property, value).map((option) => <Tag key={option.id} option={option} />)}
        </span>
      );
    case 'date':
      return <span className="truncate">{formatDate(String(value))}</span>;
    case 'url':
      return <span className="db-url truncate">{String(value)}</span>;
    case 'number':
      return <span className="db-number truncate">{Number(value).toLocaleString()}</span>;
    case 'checkbox':
      return null;
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

function TextEditor({ property, initial, onSave, onClose }: { property: DbProperty; initial: string; onSave: (value: unknown) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  const save = () => {
    if (draft !== initial) onSave(property.type === 'number' ? (draft.trim() === '' ? undefined : Number(draft)) : draft.trim());
    onClose();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') save();
    if (event.key === 'Escape') onClose();
  };
  return (
    <input
      className="db-cell-input"
      autoFocus
      type={property.type === 'number' ? 'number' : property.type === 'date' ? 'date' : 'text'}
      value={draft}
      aria-label={property.name}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={onKeyDown}
    />
  );
}

/** One editable cell. Click to edit; tags open the option picker; a checkbox ticks straight away. */
export function Cell({ db, row, property, edit, className = 'db-cell' }: { db: Database; row: DbRow; property: DbProperty; edit: Edit; className?: string }) {
  const [editing, setEditing] = useState<Anchor | null>(null);
  const value = row.cells[property.id];
  const save = (next: unknown) => edit((current) => setCell(current, row.id, property.id, next));

  if (property.type === 'checkbox') {
    return (
      <div className={className}>
        <button role="checkbox" aria-checked={value === true} aria-label={property.name} className="db-checkbox" onClick={() => save(value !== true)}>
          {value === true && <Check size={12} strokeWidth={3} />}
        </button>
      </div>
    );
  }

  const isTags = property.type === 'select' || property.type === 'multi_select';
  const textEditing = editing && !isTags;
  return (
    <div
      className={className}
      data-editing={Boolean(editing)}
      tabIndex={textEditing ? -1 : 0}
      role="button"
      aria-label={`${property.name}: edit`}
      onClick={(event) => !editing && setEditing(anchorOf(event.currentTarget))}
      onKeyDown={(event) => event.key === 'Enter' && !editing && setEditing(anchorOf(event.currentTarget))}
    >
      {textEditing ? (
        <TextEditor property={property} initial={value === undefined ? '' : String(value)} onSave={save} onClose={() => setEditing(null)} />
      ) : (
        <CellValue property={property} row={row} />
      )}
      {editing && isTags && (
        <Popover anchor={{ ...editing, top: editing.top - 36 }} width={Math.max(editing.width, 280)} label={property.name} onClose={() => setEditing(null)}>
          <SelectMenu
            property={db.properties.find((candidate) => candidate.id === property.id) ?? property}
            value={value}
            onChange={(ids) => {
              save(property.type === 'select' ? ids[0] : ids);
              if (property.type === 'select') setEditing(null);
            }}
            onCreate={(name) => {
              let created: SelectOption | null = null;
              edit((current) => {
                const result = addOption(current, property.id, name, newId);
                created = result.option;
                return result.db;
              });
              return created;
            }}
          />
        </Popover>
      )}
    </div>
  );
}
