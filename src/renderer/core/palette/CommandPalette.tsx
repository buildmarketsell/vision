import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { usePalette, usePaletteSections, type Section } from './paletteResults';
import './palette.css';

type Item = Section['items'][number];

function Row({ item, active, onPick, onHover }: { item: Item; active: boolean; onPick: () => void; onHover: () => void }) {
  return (
    <div role="option" aria-selected={active} data-active={active} className="palette-row" onMouseMove={onHover} onClick={onPick}>
      <span className="palette-icon">{item.icon}</span>
      <span className="palette-title">{item.title}</span>
      {item.detail && <span className="palette-detail">{item.detail}</span>}
      <span className="palette-kind">{item.shortcut ? <kbd>{item.shortcut}</kbd> : item.kind}</span>
    </div>
  );
}

/** The box itself; mounted only while open, so each ⌘K starts empty. */
function Palette() {
  const close = usePalette((state) => state.close);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(0);
  const { sections, searching } = usePaletteSections(query);
  const items = sections.flatMap((section) => section.items);
  const active = Math.min(picked, Math.max(0, items.length - 1));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setPicked((active + step + items.length) % Math.max(1, items.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  // Where each section's rows start in the one list the arrow keys move through.
  const starts = sections.map((_, at) => sections.slice(0, at).reduce((count, section) => count + section.items.length, 0));
  return (
    <div className="palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Search VISION" onKeyDown={onKeyDown}>
        <div className="palette-search">
          <Search size={20} strokeWidth={1.5} />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-label="Search for places, commands, files, chats…"
            placeholder="Search for places, commands, files, chats…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPicked(0);
            }}
          />
          {searching && <span className="spinner palette-spinner" aria-label="Searching" />}
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {sections.map((section, sectionAt) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <div className="palette-section">{section.title}</div>
              {section.items.map((item, itemAt) => {
                const at = (starts[sectionAt] ?? 0) + itemAt;
                return <Row key={item.id} item={item} active={at === active} onPick={() => pick(item)} onHover={() => setPicked(at)} />;
              })}
            </div>
          ))}
          {items.length === 0 && !searching && <div className="palette-empty">Nothing found for “{query}”.</div>}
        </div>
        <div className="palette-footer">
          <span>
            {items[active] ? `Open ${items[active].kind.toLowerCase()}` : 'Nothing to open'} <kbd>↵</kbd>
          </span>
          <span>
            Move <kbd>↑</kbd>
            <kbd>↓</kbd>
          </span>
          <span>
            Close <kbd>esc</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

/** ⌘K: search everything in VISION, like Raycast (Dan, 2026-11-23). */
export function CommandPalette() {
  const open = usePalette((state) => state.open);
  return open ? createPortal(<Palette />, document.body) : null;
}
