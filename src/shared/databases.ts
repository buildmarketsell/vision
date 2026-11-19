/** Notion-style databases: typed columns (properties), rows that are also pages, table and board views. Saved app-wide on this Mac. */

export const PROPERTY_TYPES = ['title', 'text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Notion's tag colors, in its menu order. */
export const TAG_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface SelectOption {
  id: string;
  name: string;
  color: TagColor;
}

export interface DbProperty {
  id: string;
  name: string;
  type: PropertyType;
  /** Choices of a select or multi-select. */
  options: SelectOption[];
  /** Column width in the table, in pixels. */
  width: number;
}

/** text, url, date (YYYY-MM-DD) and select (option id) are strings; multi-select is option ids. */
export type CellValue = string | number | boolean | string[];

export interface DbRow {
  id: string;
  cells: Record<string, CellValue>;
  /** The page body shown when the row is opened. */
  notes: string;
  createdAt: number;
}

export type DbLayout = 'table' | 'board';

export interface Database {
  id: string;
  name: string;
  properties: DbProperty[];
  rows: DbRow[];
  layout: DbLayout;
  createdAt: number;
}

export const MAX_DATABASES = 200;
export const MAX_ROWS = 5_000;
export const MAX_PROPERTIES = 50;
export const MAX_OPTIONS = 100;
export const MAX_TEXT = 2_000;
export const MAX_NOTES = 100_000;
export const MIN_WIDTH = 80;
export const MAX_WIDTH = 800;
export const DEFAULT_WIDTH = 200;

/** Options get colors in Notion's order, going round the palette. */
export const nextTagColor = (count: number): TagColor => TAG_COLORS[count % TAG_COLORS.length] ?? 'gray';

/** Every database has a title column; this stands in if a saved file lost it. */
export const DEFAULT_TITLE: DbProperty = { id: 'title', name: 'Name', type: 'title', options: [], width: 280 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const text = (value: unknown, max = MAX_TEXT): string => (isString(value) ? value.slice(0, max) : '');
const clampWidth = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))) : DEFAULT_WIDTH;

function normalizeOption(raw: unknown): SelectOption[] {
  if (!isRecord(raw) || !isString(raw.id) || !isString(raw.name) || !raw.name.trim()) return [];
  const color = TAG_COLORS.includes(raw.color as TagColor) ? (raw.color as TagColor) : 'gray';
  return [{ id: raw.id, name: text(raw.name, 100), color }];
}

function normalizeProperty(raw: unknown): DbProperty[] {
  if (!isRecord(raw) || !isString(raw.id) || !PROPERTY_TYPES.includes(raw.type as PropertyType)) return [];
  const options = Array.isArray(raw.options) ? raw.options.flatMap(normalizeOption).slice(0, MAX_OPTIONS) : [];
  return [{ id: raw.id, name: text(raw.name, 100), type: raw.type as PropertyType, options, width: clampWidth(raw.width) }];
}

/** Keeps a cell only if its value fits its column's type (and, for tags, names an existing option). */
export function normalizeCell(property: DbProperty, value: unknown): CellValue | undefined {
  const optionIds = new Set(property.options.map((option) => option.id));
  switch (property.type) {
    case 'title':
    case 'text':
    case 'url':
      return isString(value) && value ? text(value) : undefined;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    case 'checkbox':
      return value === true ? true : undefined;
    case 'date':
      return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    case 'select':
      return isString(value) && optionIds.has(value) ? value : undefined;
    case 'multi_select': {
      const ids = Array.isArray(value) ? [...new Set(value.filter((id): id is string => isString(id) && optionIds.has(id)))] : [];
      return ids.length ? ids : undefined;
    }
  }
}

function normalizeRow(raw: unknown, properties: DbProperty[]): DbRow[] {
  if (!isRecord(raw) || !isString(raw.id)) return [];
  const rawCells = isRecord(raw.cells) ? raw.cells : {};
  const cells: Record<string, CellValue> = {};
  for (const property of properties) {
    const value = normalizeCell(property, rawCells[property.id]);
    if (value !== undefined) cells[property.id] = value;
  }
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : 0;
  return [{ id: raw.id, cells, notes: text(raw.notes, MAX_NOTES), createdAt }];
}

/** Checks one database from disk or from a window. Every database keeps exactly one title column, first. */
export function normalizeDatabase(raw: unknown): Database | null {
  if (!isRecord(raw) || !isString(raw.id)) return null;
  const all = Array.isArray(raw.properties) ? raw.properties.flatMap(normalizeProperty) : [];
  const seen = new Set<string>();
  const unique = all.filter((property) => !seen.has(property.id) && seen.add(property.id));
  const title = unique.find((property) => property.type === 'title') ?? DEFAULT_TITLE;
  const properties = [title, ...unique.filter((property) => property.type !== 'title')].slice(0, MAX_PROPERTIES);
  const rows = Array.isArray(raw.rows) ? raw.rows.flatMap((row) => normalizeRow(row, properties)).slice(0, MAX_ROWS) : [];
  return {
    id: raw.id,
    name: text(raw.name, 200),
    properties,
    rows,
    layout: raw.layout === 'board' ? 'board' : 'table',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  };
}

export function normalizeDatabases(raw: unknown): Database[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => normalizeDatabase(item) ?? []).slice(0, MAX_DATABASES);
}
