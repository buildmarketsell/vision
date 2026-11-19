import { useState } from 'react';
import { X } from 'lucide-react';
import { nextTagColor, type DbProperty, type SelectOption } from '../../../shared/databases';

export function Tag({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span className="db-tag" data-color={option.color}>
      <span className="truncate">{option.name}</span>
      {onRemove && (
        <button className="db-tag-remove" aria-label={`Remove ${option.name}`} onClick={onRemove}>
          <X size={11} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}

/** The tags chosen in a cell, in the order they were picked. */
export function chosenOptions(property: DbProperty, value: unknown): SelectOption[] {
  const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return ids.flatMap((id) => property.options.find((option) => option.id === id) ?? []);
}

/**
 * Notion's option picker: chosen tags on top, a search box, the options, and "Create" for a new one.
 * A select keeps one tag (picking closes); a multi-select keeps adding.
 */
export function SelectMenu({ property, value, onChange, onCreate }: {
  property: DbProperty;
  value: unknown;
  onChange: (ids: string[]) => void;
  /** Adds the option to the column and returns it. */
  onCreate: (name: string) => SelectOption | null;
}) {
  const [query, setQuery] = useState('');
  const chosen = chosenOptions(property, value);
  const multi = property.type === 'multi_select';
  const clean = query.trim();
  const shown = property.options.filter((option) => option.name.toLowerCase().includes(clean.toLowerCase()));
  const exact = property.options.some((option) => option.name.toLowerCase() === clean.toLowerCase());
  const pick = (option: SelectOption) => {
    const ids = chosen.map((item) => item.id);
    if (!multi) onChange(ids[0] === option.id ? [] : [option.id]);
    else onChange(ids.includes(option.id) ? ids : [...ids, option.id]);
    setQuery('');
  };
  const create = () => {
    const option = clean ? onCreate(clean) : null;
    if (option) pick(option);
  };
  return (
    <div className="db-select-menu">
      <div className="db-select-field">
        {chosen.map((option) => (
          <Tag key={option.id} option={option} onRemove={() => onChange(chosen.filter((item) => item.id !== option.id).map((item) => item.id))} />
        ))}
        <input
          autoFocus
          value={query}
          aria-label="Search for an option"
          placeholder={chosen.length ? '' : 'Search for an option…'}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !exact) create();
            else if (event.key === 'Enter' && shown[0]) pick(shown[0]);
            if (event.key === 'Backspace' && !query && chosen.length) onChange(chosen.slice(0, -1).map((item) => item.id));
          }}
        />
      </div>
      <div className="db-menu-hint">Select an option or create one</div>
      <div className="db-menu-list" role="listbox" aria-label={property.name}>
        {shown.map((option) => (
          <button key={option.id} role="option" aria-selected={chosen.includes(option)} className="row w-full" onClick={() => pick(option)}>
            <Tag option={option} />
          </button>
        ))}
        {clean && !exact && (
          <button className="row w-full" onClick={create}>
            <span className="db-menu-faint">Create</span>
            <Tag option={{ id: 'new', name: clean, color: nextTagColor(property.options.length) }} />
          </button>
        )}
      </div>
    </div>
  );
}
