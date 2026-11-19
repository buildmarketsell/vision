/** Edits to a database. Pure: each returns a new database; ids come from `newId` so tests can fix them. */
import { DEFAULT_TITLE, DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH, nextTagColor, normalizeCell, type CellValue, type Database, type DbProperty, type DbRow, type PropertyType, type SelectOption } from './databases';

type NewId = () => string;

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  title: 'Title',
  text: 'Text',
  number: 'Number',
  select: 'Select',
  multi_select: 'Multi-select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL',
};

/** A new database like Notion's default: Name, Status (Not started / In progress / Done), Tags and Date, three empty rows. */
export function createDatabase(name: string, newId: NewId, now: number): Database {
  const status: DbProperty = {
    id: newId(),
    name: 'Status',
    type: 'select',
    width: 160,
    options: [
      { id: newId(), name: 'Not started', color: 'gray' },
      { id: newId(), name: 'In progress', color: 'blue' },
      { id: newId(), name: 'Done', color: 'green' },
    ],
  };
  const properties: DbProperty[] = [
    { id: newId(), name: 'Name', type: 'title', options: [], width: 280 },
    status,
    { id: newId(), name: 'Tags', type: 'multi_select', options: [], width: DEFAULT_WIDTH },
    { id: newId(), name: 'Date', type: 'date', options: [], width: 160 },
  ];
  const rows = [0, 1, 2].map((): DbRow => ({ id: newId(), cells: {}, notes: '', createdAt: now }));
  return { id: newId(), name, properties, rows, layout: 'table', createdAt: now };
}

export const titleProperty = (db: Database): DbProperty => db.properties[0] ?? DEFAULT_TITLE;
export const rowTitle = (db: Database, row: DbRow): string => String(row.cells[titleProperty(db).id] ?? '');

const mapRows = (db: Database, rowId: string, change: (row: DbRow) => DbRow): Database => ({
  ...db,
  rows: db.rows.map((row) => (row.id === rowId ? change(row) : row)),
});

const mapProperty = (db: Database, propertyId: string, change: (property: DbProperty) => DbProperty): Database => ({
  ...db,
  properties: db.properties.map((property) => (property.id === propertyId ? change(property) : property)),
});

export function addRow(db: Database, newId: NewId, now: number, cells: Record<string, CellValue> = {}): { db: Database; row: DbRow } {
  const row: DbRow = { id: newId(), cells, notes: '', createdAt: now };
  return { db: { ...db, rows: [...db.rows, row] }, row };
}

/** Sets one cell; an empty or invalid value clears it. */
export function setCell(db: Database, rowId: string, propertyId: string, value: unknown): Database {
  const property = db.properties.find((candidate) => candidate.id === propertyId);
  if (!property) return db;
  const clean = normalizeCell(property, value);
  return mapRows(db, rowId, (row) => {
    const cells = { ...row.cells };
    if (clean === undefined) delete cells[propertyId];
    else cells[propertyId] = clean;
    return { ...row, cells };
  });
}

/** Unchanged notes return the same database, so nothing is saved. */
export const setNotes = (db: Database, rowId: string, notes: string): Database =>
  db.rows.find((row) => row.id === rowId)?.notes === notes ? db : mapRows(db, rowId, (row) => ({ ...row, notes }));
export const removeRow = (db: Database, rowId: string): Database => ({ ...db, rows: db.rows.filter((row) => row.id !== rowId) });

export function duplicateRow(db: Database, rowId: string, newId: NewId, now: number): Database {
  const index = db.rows.findIndex((row) => row.id === rowId);
  const original = db.rows[index];
  if (!original) return db;
  const copy: DbRow = { ...original, id: newId(), cells: { ...original.cells }, createdAt: now };
  return { ...db, rows: [...db.rows.slice(0, index + 1), copy, ...db.rows.slice(index + 1)] };
}

export function addProperty(db: Database, type: PropertyType, newId: NewId): { db: Database; property: DbProperty } {
  const base = PROPERTY_LABELS[type];
  const names = new Set(db.properties.map((property) => property.name));
  let name = base;
  for (let n = 2; names.has(name); n += 1) name = `${base} ${n}`;
  const property: DbProperty = { id: newId(), name, type: type === 'title' ? 'text' : type, options: [], width: DEFAULT_WIDTH };
  return { db: { ...db, properties: [...db.properties, property] }, property };
}

export const renameProperty = (db: Database, propertyId: string, name: string): Database =>
  mapProperty(db, propertyId, (property) => ({ ...property, name: name.slice(0, 100) }));

export const resizeProperty = (db: Database, propertyId: string, width: number): Database =>
  mapProperty(db, propertyId, (property) => ({ ...property, width: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))) }));

/** The title column can't be deleted: every row needs a name. */
export function removeProperty(db: Database, propertyId: string): Database {
  if (titleProperty(db).id === propertyId) return db;
  return {
    ...db,
    properties: db.properties.filter((property) => property.id !== propertyId),
    rows: db.rows.map((row) => {
      const cells = { ...row.cells };
      delete cells[propertyId];
      return { ...row, cells };
    }),
  };
}

/** Changes a column's type, keeping values that still make sense (text ↔ url, select → multi-select and back). */
export function changePropertyType(db: Database, propertyId: string, type: PropertyType): Database {
  const current = db.properties.find((property) => property.id === propertyId);
  if (!current || current.type === 'title' || type === 'title' || current.type === type) return db;
  const next: DbProperty = { ...current, type };
  const convert = (value: CellValue | undefined): unknown => {
    if (value === undefined) return undefined;
    if (type === 'multi_select' && typeof value === 'string') return [value];
    if (type === 'select' && Array.isArray(value)) return value[0];
    if (type === 'number' && typeof value === 'string') return value.trim() === '' ? undefined : Number(value);
    if ((type === 'text' || type === 'url') && !Array.isArray(value) && typeof value !== 'boolean') return String(value);
    return value;
  };
  return {
    ...mapProperty(db, propertyId, () => next),
    rows: db.rows.map((row) => {
      const cells = { ...row.cells };
      const value = normalizeCell(next, convert(row.cells[propertyId]));
      if (value === undefined) delete cells[propertyId];
      else cells[propertyId] = value;
      return { ...row, cells };
    }),
  };
}

/** Adds a tag option; colors go round Notion's palette like Notion does. */
export function addOption(db: Database, propertyId: string, name: string, newId: NewId): { db: Database; option: SelectOption | null } {
  const property = db.properties.find((candidate) => candidate.id === propertyId);
  const clean = name.trim().slice(0, 100);
  if (!property || !clean) return { db, option: null };
  const existing = property.options.find((option) => option.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { db, option: existing };
  const option: SelectOption = { id: newId(), name: clean, color: nextTagColor(property.options.length) };
  return { db: mapProperty(db, propertyId, (current) => ({ ...current, options: [...current.options, option] })), option };
}

export type SortDirection = 'asc' | 'desc';
export interface RowSort {
  propertyId: string;
  direction: SortDirection;
}

function sortKey(property: DbProperty, value: CellValue | undefined): string | number {
  if (value === undefined) return '';
  if (property.type === 'select') return property.options.findIndex((option) => option.id === value);
  if (Array.isArray(value)) return value.map((id) => property.options.find((option) => option.id === id)?.name ?? '').join(', ');
  if (typeof value === 'boolean') return 1;
  return value;
}

/** Rows matching the search (any text cell or tag name), in the chosen order. Empty cells always go last. */
export function visibleRows(db: Database, search: string, sort: RowSort | null): DbRow[] {
  const query = search.trim().toLowerCase();
  const matches = (row: DbRow) =>
    !query ||
    db.properties.some((property) => {
      const value = row.cells[property.id];
      if (value === undefined) return false;
      const words = property.options.length ? [value].flat().map((id) => property.options.find((option) => option.id === id)?.name ?? '') : [String(value)];
      return words.some((word) => word.toLowerCase().includes(query));
    });
  const rows = db.rows.filter(matches);
  const property = sort && db.properties.find((candidate) => candidate.id === sort.propertyId);
  if (!sort || !property) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortKey(property, a.cells[property.id]);
    const right = sortKey(property, b.cells[property.id]);
    if (left === '' || right === '') return left === right ? 0 : left === '' ? 1 : -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
  });
}
