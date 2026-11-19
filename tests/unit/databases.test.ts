import { describe, expect, it } from 'vitest';
import { normalizeDatabase, normalizeDatabases, type Database } from '../../src/shared/databases';
import {
  addOption,
  addProperty,
  addRow,
  changePropertyType,
  createDatabase,
  duplicateRow,
  removeProperty,
  rowTitle,
  setCell,
  titleProperty,
  visibleRows,
} from '../../src/shared/databaseOps';

function ids() {
  let n = 0;
  return () => `id${(n += 1)}`;
}

function sample(): { db: Database; newId: () => string; status: string; tags: string; date: string } {
  const newId = ids();
  const db = createDatabase('Projects', newId, 1);
  const [, status, tags, date] = db.properties.map((property) => property.id);
  return { db, newId, status: status ?? '', tags: tags ?? '', date: date ?? '' };
}

describe('createDatabase', () => {
  it('starts like Notion: Name, Status with three options, Tags, Date, three empty rows', () => {
    const { db } = sample();
    expect(db.properties.map((property) => property.type)).toEqual(['title', 'select', 'multi_select', 'date']);
    expect(db.properties[1]?.options.map((option) => option.name)).toEqual(['Not started', 'In progress', 'Done']);
    expect(db.rows).toHaveLength(3);
  });
});

describe('normalizeDatabase', () => {
  it('drops cells that do not fit their column', () => {
    const { db, status, date } = sample();
    const raw = { ...db, rows: [{ id: 'r', cells: { [status]: 'not-an-option', [date]: '19/11/2026', nope: 'x' }, notes: 5 }] };
    expect(normalizeDatabase(raw)?.rows[0]).toEqual({ id: 'r', cells: {}, notes: '', createdAt: 0 });
  });

  it('puts a title column first, adding one if it is missing', () => {
    const fixed = normalizeDatabase({ id: 'd', properties: [{ id: 'n', name: 'N', type: 'number' }] });
    expect(fixed?.properties.map((property) => property.type)).toEqual(['title', 'number']);
  });

  it('rejects junk', () => {
    expect(normalizeDatabases('nope')).toEqual([]);
    expect(normalizeDatabases([null, { id: 3 }])).toEqual([]);
  });
});

describe('edits', () => {
  it('sets and clears cells by type', () => {
    const { db, date } = sample();
    const rowId = db.rows[0]?.id ?? '';
    const titled = setCell(db, rowId, titleProperty(db).id, 'Launch');
    expect(rowTitle(titled, titled.rows[0]!)).toBe('Launch');
    expect(setCell(titled, rowId, date, '2026-11-19').rows[0]?.cells[date]).toBe('2026-11-19');
    expect(setCell(titled, rowId, titleProperty(db).id, '').rows[0]?.cells).toEqual({});
  });

  it('reuses an option with the same name and colors new ones in turn', () => {
    const { db, newId, tags } = sample();
    const first = addOption(db, tags, 'Ads', newId);
    expect(first.option?.color).toBe('gray');
    expect(addOption(first.db, tags, 'ads', newId).option?.id).toBe(first.option?.id);
    expect(addOption(first.db, tags, 'Copy', newId).option?.color).toBe('brown');
  });

  it('keeps the title column and gives new columns unique names', () => {
    const { db, newId } = sample();
    expect(removeProperty(db, titleProperty(db).id)).toBe(db);
    const once = addProperty(db, 'text', newId).db;
    expect(addProperty(once, 'text', newId).property.name).toBe('Text 2');
  });

  it('keeps tag values when switching select to multi-select', () => {
    const { db, status } = sample();
    const done = db.properties[1]?.options[2]?.id ?? '';
    const rowId = db.rows[0]?.id ?? '';
    const changed = changePropertyType(setCell(db, rowId, status, done), status, 'multi_select');
    expect(changed.rows[0]?.cells[status]).toEqual([done]);
  });

  it('duplicates a row right below the original', () => {
    const { db, newId } = sample();
    const copy = duplicateRow(db, db.rows[0]?.id ?? '', newId, 2);
    expect(copy.rows).toHaveLength(4);
    expect(copy.rows[1]?.createdAt).toBe(2);
  });
});

describe('visibleRows', () => {
  it('searches text and tag names, and sorts with empty cells last', () => {
    const { db: base, newId, status } = sample();
    const [notStarted, , done] = base.properties[1]?.options ?? [];
    let db: Database = { ...base, rows: [] };
    for (const [name, option] of [['b', done?.id], ['a', notStarted?.id], ['c', undefined]] as const) {
      db = addRow(db, newId, 1, { [titleProperty(db).id]: name, ...(option ? { [status]: option } : {}) }).db;
    }
    const names = (rows: Database['rows']) => rows.map((row) => rowTitle(db, row));
    expect(names(visibleRows(db, 'done', null))).toEqual(['b']);
    expect(names(visibleRows(db, '', { propertyId: status, direction: 'asc' }))).toEqual(['a', 'b', 'c']);
    expect(names(visibleRows(db, '', { propertyId: titleProperty(db).id, direction: 'desc' }))).toEqual(['c', 'b', 'a']);
  });
});
