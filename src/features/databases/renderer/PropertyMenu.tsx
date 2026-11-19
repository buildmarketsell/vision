import { useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, Trash2 } from 'lucide-react';
import { PROPERTY_TYPES, type DbProperty, type PropertyType } from '../../../shared/databases';
import { addProperty, changePropertyType, PROPERTY_LABELS, removeProperty, renameProperty, type RowSort } from '../../../shared/databaseOps';
import { TypeIcon } from './Popover';
import type { Edit } from './Cell';
import { newId } from './dbStore';

const ICON = { size: 14, strokeWidth: 1.75 };
const CHOOSABLE = PROPERTY_TYPES.filter((type) => type !== 'title');

function TypeList({ current, onPick }: { current?: PropertyType; onPick: (type: PropertyType) => void }) {
  return (
    <div className="db-menu-list" role="menu">
      {CHOOSABLE.map((type) => (
        <button key={type} role="menuitemradio" aria-checked={current === type} className="row w-full" onClick={() => onPick(type)}>
          <TypeIcon type={type} />
          <span className="flex-1">{PROPERTY_LABELS[type]}</span>
          {current === type && <Check {...ICON} />}
        </button>
      ))}
    </div>
  );
}

/** "+" at the end of the header: pick a type, and the new column is added. */
export function AddPropertyMenu({ edit, onDone }: { edit: Edit; onDone: () => void }) {
  return (
    <>
      <div className="db-menu-hint">Type</div>
      <TypeList
        onPick={(type) => {
          edit((db) => addProperty(db, type, newId).db);
          onDone();
        }}
      />
    </>
  );
}

/** Click a column header: rename it, change its type, sort by it, or delete it. */
export function PropertyMenu({ property, edit, sort, setSort, onDone }: {
  property: DbProperty;
  edit: Edit;
  sort: RowSort | null;
  setSort: (sort: RowSort | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(property.name);
  const [choosingType, setChoosingType] = useState(false);
  const isTitle = property.type === 'title';
  const rename = () => name.trim() && name !== property.name && edit((db) => renameProperty(db, property.id, name.trim()));
  const sortBy = (direction: RowSort['direction']) => {
    const same = sort?.propertyId === property.id && sort.direction === direction;
    setSort(same ? null : { propertyId: property.id, direction });
    onDone();
  };
  if (choosingType) {
    return (
      <TypeList
        current={property.type}
        onPick={(type) => {
          edit((db) => changePropertyType(db, property.id, type));
          onDone();
        }}
      />
    );
  }
  return (
    <div className="db-menu-list">
      <input
        className="db-menu-input"
        autoFocus
        value={name}
        aria-label="Property name"
        onChange={(event) => setName(event.target.value)}
        onBlur={rename}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            rename();
            onDone();
          }
        }}
      />
      {!isTitle && (
        <button className="row w-full" onClick={() => setChoosingType(true)}>
          <TypeIcon type={property.type} />
          <span className="flex-1">Type</span>
          <span className="db-menu-faint">{PROPERTY_LABELS[property.type]}</span>
        </button>
      )}
      <div className="db-menu-divider" />
      <button className="row w-full" aria-pressed={sort?.propertyId === property.id && sort.direction === 'asc'} onClick={() => sortBy('asc')}>
        <ArrowUpNarrowWide {...ICON} /> Sort ascending
      </button>
      <button className="row w-full" aria-pressed={sort?.propertyId === property.id && sort.direction === 'desc'} onClick={() => sortBy('desc')}>
        <ArrowDownWideNarrow {...ICON} /> Sort descending
      </button>
      {!isTitle && (
        <>
          <div className="db-menu-divider" />
          <button
            className="row w-full db-danger"
            onClick={() => {
              edit((db) => removeProperty(db, property.id));
              onDone();
            }}
          >
            <Trash2 {...ICON} /> Delete property
          </button>
        </>
      )}
    </div>
  );
}
