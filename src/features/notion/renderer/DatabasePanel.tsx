import { useCallback, useEffect, useState } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { ArrowUpDown, Search, SquareKanban, Table2, X } from 'lucide-react';
import type { Database, DbLayout } from '../../../shared/databases';
import { addRow, visibleRows, type RowSort } from '../../../shared/databaseOps';
import type { TabParams } from '../../../renderer/core/feature';
import type { Edit } from './Cell';
import { BoardView } from './BoardView';
import { RowPeek } from './RowPeek';
import { TableView } from './TableView';
import { databases, newId } from './dbStore';
import './databases.css';

const LAYOUTS: { value: DbLayout; label: string; icon: typeof Table2 }[] = [
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'board', label: 'Board', icon: SquareKanban },
];

function PageTitle({ db, edit }: { db: Database; edit: Edit }) {
  const [draft, setDraft] = useState(db.name);
  return (
    <input
      className="db-title"
      value={draft}
      placeholder="Untitled"
      aria-label="Database name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== db.name && edit((current) => ({ ...current, name: draft.trim() }))}
      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
    />
  );
}

function SearchBox({ search, setSearch }: { search: string; setSearch: (search: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open && !search) {
    return (
      <button className="icon-button" title="Search" aria-label="Search" onClick={() => setOpen(true)}>
        <Search size={15} strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <div className="db-search">
      <Search size={14} strokeWidth={1.75} aria-hidden />
      <input autoFocus value={search} placeholder="Type to search…" aria-label="Search" onChange={(event) => setSearch(event.target.value)} onBlur={() => setOpen(false)} />
      {search && (
        <button className="icon-button" aria-label="Clear search" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch('')}>
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/**
 * A database: Notion's title, view tabs, toolbar, the table or board, and the side peek.
 * `embedded` is the inline version inside a page: smaller title (click it to open the full database), no page margins.
 */
export function DatabasePage({ id, embedded = false, onOpenFull }: { id: string; embedded?: boolean; onOpenFull?: () => void }) {
  const { items, error } = databases.useLoaded();
  const db = items?.find((candidate) => candidate.id === id);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<RowSort | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const edit: Edit = useCallback((fn) => databases.change(id, fn), [id]);
  const closePeek = useCallback(() => setPeek(null), [setPeek]);

  if (items === null) return <div className="db-page">{error ? <div className="db-error">{error}</div> : <div className="spinner mx-auto mt-12" aria-label="Loading" />}</div>;
  if (!db) return <div className="db-page" data-embedded={embedded}><p className="db-gone">This database was deleted.</p></div>;

  const rows = visibleRows(db, search, sort);
  const peekRow = db.rows.find((row) => row.id === peek);
  const sortName = sort && db.properties.find((property) => property.id === sort.propertyId)?.name;
  const newPage = () => {
    let rowId = '';
    edit((current) => {
      const result = addRow(current, newId, Date.now());
      rowId = result.row.id;
      return result.db;
    });
    setPeek(rowId);
  };

  return (
    <div className="db-page" data-embedded={embedded}>
      <div className="db-main">
        {embedded ? (
          <button className="db-inline-title" onClick={onOpenFull} title="Open as full page">
            <Table2 size={18} strokeWidth={1.5} aria-hidden /> {db.name || 'Untitled'}
          </button>
        ) : (
          <div className="db-head">
            <Table2 size={36} strokeWidth={1.25} className="db-head-icon" aria-hidden />
            <PageTitle key={db.name} db={db} edit={edit} />
          </div>
        )}
        {error && <div className="db-error" role="alert">{error}</div>}
        <div className="db-viewbar">
          <div className="db-tabs" role="tablist" aria-label="Views">
            {LAYOUTS.map(({ value, label, icon: Icon }) => (
              <button key={value} role="tab" aria-selected={db.layout === value} className="db-tab" onClick={() => edit((current) => ({ ...current, layout: value }))}>
                <Icon size={14} strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
          <div className="db-tools">
            {sortName && (
              <button className="db-chip" title="Clear sort" onClick={() => setSort(null)}>
                <ArrowUpDown size={13} strokeWidth={1.75} /> {sortName} <X size={12} strokeWidth={2} />
              </button>
            )}
            <SearchBox search={search} setSearch={setSearch} />
            <button className="db-new" onClick={newPage}>New</button>
          </div>
        </div>
        <div className="db-view" data-layout={db.layout}>
          {db.layout === 'board' ? (
            <BoardView db={db} rows={rows} edit={edit} onOpen={setPeek} />
          ) : (
            <TableView db={db} rows={rows} edit={edit} sort={sort} setSort={setSort} onOpen={setPeek} />
          )}
        </div>
      </div>
      {peekRow && <RowPeek key={peekRow.id} db={db} row={peekRow} edit={edit} onClose={closePeek} />}
    </div>
  );
}

/** The same page in a dock tab (databases opened as tabs before the Notion view existed). */
export function DatabasePanel({ params, api }: IDockviewPanelProps<TabParams>) {
  const id = params.id ?? '';
  const name = databases.useLoaded().items?.find((db) => db.id === id)?.name;
  useEffect(() => {
    if (name !== undefined && api.title !== (name || 'Untitled')) api.setTitle(name || 'Untitled');
  }, [api, name]);
  return <DatabasePage id={id} />;
}
