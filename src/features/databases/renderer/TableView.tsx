import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, PanelRightOpen, Plus, Trash2 } from 'lucide-react';
import type { Database, DbProperty, DbRow } from '../../../shared/databases';
import { addRow, duplicateRow, removeRow, resizeProperty, type RowSort } from '../../../shared/databaseOps';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { Cell, type Edit } from './Cell';
import { anchorOf, Popover, TypeIcon, type Anchor } from './Popover';
import { AddPropertyMenu, PropertyMenu } from './PropertyMenu';
import { newId } from './dbStore';

const ICON = { size: 14, strokeWidth: 1.75 };

interface TableProps {
  db: Database;
  rows: DbRow[];
  edit: Edit;
  sort: RowSort | null;
  setSort: (sort: RowSort | null) => void;
  onOpen: (rowId: string) => void;
}

/** A column header: click for its menu, drag its right edge to resize. */
function Header({ property, width, onResize, onResizeEnd, sort, onMenu }: {
  property: DbProperty;
  width: number;
  onResize: (width: number) => void;
  onResizeEnd: (width: number) => void;
  sort: RowSort | null;
  onMenu: (anchor: Anchor) => void;
}) {
  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    let last = width;
    const move = (moveEvent: PointerEvent) => {
      last = Math.max(80, width + moveEvent.clientX - startX);
      onResize(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onResizeEnd(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const sorted = sort?.propertyId === property.id ? sort.direction : null;
  return (
    <div className="db-th" style={{ width }} role="columnheader">
      <button className="db-th-button" onClick={(event) => onMenu(anchorOf(event.currentTarget))}>
        <TypeIcon type={property.type} />
        <span className="truncate">{property.name}</span>
        {sorted === 'asc' && <ArrowUp size={12} strokeWidth={2} aria-label="sorted ascending" />}
        {sorted === 'desc' && <ArrowDown size={12} strokeWidth={2} aria-label="sorted descending" />}
      </button>
      <div className="db-resize" onPointerDown={startResize} aria-hidden />
    </div>
  );
}

export function TableView({ db, rows, edit, sort, setSort, onOpen }: TableProps) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState<{ anchor: Anchor; propertyId: string | null } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const widthOf = (property: DbProperty) => widths[property.id] ?? property.width;
  const menuProperty = menu?.propertyId ? db.properties.find((property) => property.id === menu.propertyId) : null;

  return (
    <div className="db-table" role="table" aria-label={db.name || 'Untitled'}>
      <div className="db-tr db-thead" role="row">
        {db.properties.map((property) => (
          <Header
            key={property.id}
            property={property}
            width={widthOf(property)}
            sort={sort}
            onResize={(width) => setWidths((current) => ({ ...current, [property.id]: width }))}
            onResizeEnd={(width) => {
              edit((current) => resizeProperty(current, property.id, width));
              setWidths({});
            }}
            onMenu={(anchor) => setMenu({ anchor, propertyId: property.id })}
          />
        ))}
        <button className="db-th-add" aria-label="Add a property" onClick={(event) => setMenu({ anchor: anchorOf(event.currentTarget), propertyId: null })}>
          <Plus {...ICON} />
        </button>
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="db-tr"
          role="row"
          onContextMenu={(event) => {
            event.preventDefault();
            setRowMenu({ x: event.clientX, y: event.clientY, rowId: row.id });
          }}
        >
          {db.properties.map((property, index) => (
            <div key={property.id} className="db-td" style={{ width: widthOf(property) }} role="cell" data-title={index === 0}>
              <Cell db={db} row={row} property={property} edit={edit} />
              {index === 0 && (
                <button className="db-open" onClick={() => onOpen(row.id)}>
                  <PanelRightOpen size={12} strokeWidth={2} /> Open
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      <button className="db-new-row" onClick={() => edit((current) => addRow(current, newId, Date.now()).db)}>
        <Plus {...ICON} /> New page
      </button>

      {menu && (
        <Popover anchor={menu.anchor} width={240} label={menuProperty ? `${menuProperty.name} options` : 'Add a property'} onClose={() => setMenu(null)}>
          {menuProperty ? (
            <PropertyMenu property={menuProperty} edit={edit} sort={sort} setSort={setSort} onDone={() => setMenu(null)} />
          ) : (
            <AddPropertyMenu edit={edit} onDone={() => setMenu(null)} />
          )}
        </Popover>
      )}
      {rowMenu && (
        <ContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={() => setRowMenu(null)}
          items={[
            { label: 'Open', icon: <PanelRightOpen {...ICON} />, onSelect: () => onOpen(rowMenu.rowId) },
            { label: 'Duplicate', icon: <Copy {...ICON} />, onSelect: () => edit((current) => duplicateRow(current, rowMenu.rowId, newId, Date.now())) },
            { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => edit((current) => removeRow(current, rowMenu.rowId)) },
          ]}
        />
      )}
    </div>
  );
}
