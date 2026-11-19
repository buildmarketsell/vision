import { useState } from 'react';
import { Search, SquarePen, Table2, Trash2, X } from 'lucide-react';
import { pageTitle } from '../../../shared/pageOps';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { createDb, databases } from './dbStore';
import { addPage, pages, useNav } from './pageStore';
import { PageIcon, PageTree, SidebarRow } from './PageTree';
import './notion.css';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="notion-section" aria-label={label}>
      <div className="notion-section-label">{label}</div>
      {children}
    </section>
  );
}

/** The Notion view's sidebar: search, favorites, the page tree and databases, a New page button at the bottom. */
export function NotionSidebar() {
  const { items: allPages, error } = pages.useLoaded();
  const { items: allDbs } = databases.useLoaded();
  const current = useNav((state) => state.current);
  const open = useNav((state) => state.open);
  const [query, setQuery] = useState<string | null>(null);
  const [dbMenu, setDbMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const list = allPages ?? [];
  const search = query?.trim().toLowerCase() ?? '';
  const newPage = () => open({ kind: 'page', id: addPage(null).id });

  return (
    <div className="notion-sidebar">
      <div className="notion-sidebar-scroll">
        {query === null ? (
          <SidebarRow icon={<Search size={15} strokeWidth={1.5} />} label="Search" onClick={() => setQuery('')} />
        ) : (
          <div className="notion-search">
            <Search size={15} strokeWidth={1.5} aria-hidden />
            <input autoFocus value={query} placeholder="Search pages…" aria-label="Search pages" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setQuery(null)} />
            <button className="icon-button" aria-label="Close search" onClick={() => setQuery(null)}>
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        )}
        {error && <div className="db-error" role="alert">{error}</div>}
        {allPages === null && !error && <div className="spinner mx-auto mt-6" aria-label="Loading pages" />}

        {search ? (
          <Section label="Results">
            {list
              .filter((page) => pageTitle(page).toLowerCase().includes(search))
              .map((page) => (
                <SidebarRow key={page.id} icon={<PageIcon page={page} />} label={pageTitle(page)} onClick={() => open({ kind: 'page', id: page.id })} />
              ))}
            {(allDbs ?? [])
              .filter((db) => (db.name || 'Untitled').toLowerCase().includes(search))
              .map((db) => (
                <SidebarRow key={db.id} icon={<Table2 size={15} strokeWidth={1.5} />} label={db.name || 'Untitled'} onClick={() => open({ kind: 'database', id: db.id })} />
              ))}
          </Section>
        ) : (
          <>
            {list.some((page) => page.favorite) && (
              <Section label="Favorites">
                <PageTree pages={list} roots={list.filter((page) => page.favorite)} />
              </Section>
            )}
            <Section label="Private">
              <PageTree pages={list} roots={list.filter((page) => page.parentId === null)} />
              {allPages?.length === 0 && <SidebarRow icon={<SquarePen size={15} strokeWidth={1.5} />} label="Add a page" onClick={newPage} />}
            </Section>
            <Section label="Databases">
              {(allDbs ?? []).map((db) => (
                <SidebarRow
                  key={db.id}
                  icon={<Table2 size={15} strokeWidth={1.5} />}
                  label={db.name || 'Untitled'}
                  active={current?.kind === 'database' && current.id === db.id}
                  onClick={() => open({ kind: 'database', id: db.id })}
                  onMenu={(event) => {
                    event.preventDefault();
                    setDbMenu({ x: event.clientX, y: event.clientY, id: db.id });
                  }}
                />
              ))}
              <SidebarRow icon={<Table2 size={15} strokeWidth={1.5} />} label="New database" onClick={() => open({ kind: 'database', id: createDb().id })} />
            </Section>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 p-3">
        <button className="pill-button flex-1" onClick={newPage}>
          <SquarePen size={15} strokeWidth={1.5} /> New page
        </button>
      </div>
      {dbMenu && (
        <ContextMenu
          x={dbMenu.x}
          y={dbMenu.y}
          onClose={() => setDbMenu(null)}
          items={[{ label: 'Delete', icon: <Trash2 size={15} strokeWidth={1.5} />, danger: true, onSelect: () => databases.remove(dbMenu.id) }]}
        />
      )}
    </div>
  );
}
