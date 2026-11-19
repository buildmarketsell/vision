import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, SquarePen, Star, Table2, Trash2 } from 'lucide-react';
import type { Page } from '../../../shared/pages';
import { pagePath, pageTitle } from '../../../shared/pageOps';
import { ContextMenu } from '../../../renderer/components/ContextMenu';
import { BlockEditor } from './BlockEditor';
import { DatabasePage } from './DatabasePanel';
import { Cover, CoverPicker, HeaderButtons, IconPicker } from './PageHeader';
import { PageIcon } from './PageTree';
import type { Anchor } from './Popover';
import { databases } from './dbStore';
import { addPage, changePage, pages, removePage, useNav } from './pageStore';
import './notion.css';

function PageView({ page, all }: { page: Page; all: Page[] }) {
  const open = useNav((state) => state.open);
  const [picker, setPicker] = useState<{ kind: 'icon' | 'cover'; anchor: Anchor } | null>(null);
  return (
    <div className="notion-scroll">
      <Cover page={page} />
      <div className="notion-page" data-has-cover={Boolean(page.cover)}>
        {page.icon && (
          <button className="notion-page-icon" aria-label="Change icon" onClick={(event) => setPicker({ kind: 'icon', anchor: { left: event.clientX, top: event.clientY + 8, width: 0 } })}>
            {page.icon}
          </button>
        )}
        <HeaderButtons page={page} onIcon={(anchor) => setPicker({ kind: 'icon', anchor })} onCover={(anchor) => setPicker({ kind: 'cover', anchor })} />
        <textarea
          className="notion-title"
          rows={1}
          value={page.title}
          placeholder="Untitled"
          aria-label="Page title"
          autoFocus={!page.title}
          onChange={(event) => changePage(page.id, (current) => ({ ...current, title: event.target.value.replace(/\n/g, '') }))}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.currentTarget.closest('.notion-page')?.querySelector<HTMLTextAreaElement>('.nb-input')?.focus();
          }}
        />
        <BlockEditor page={page} pages={all} onOpen={(kind, id) => open({ kind, id })} />
      </div>
      {picker?.kind === 'icon' && <IconPicker page={page} anchor={picker.anchor} onClose={() => setPicker(null)} />}
      {picker?.kind === 'cover' && <CoverPicker page={page} anchor={picker.anchor} onClose={() => setPicker(null)} />}
    </div>
  );
}

function TopBar({ page }: { page: Page | null }) {
  const { back, forward, goBack, goForward, open, current } = useNav();
  const all = pages.useStore((state) => state.items) ?? [];
  const dbName = databases.useStore((state) => state.items)?.find((db) => db.id === current?.id)?.name;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const path = page ? pagePath(all, page.id) : [];
  return (
    <div className="notion-topbar drag-region">
      <div className="notion-topbar-left no-drag">
        <button className="icon-button" aria-label="Back" disabled={!back.length} onClick={goBack}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button className="icon-button" aria-label="Forward" disabled={!forward.length} onClick={goForward}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <nav className="notion-crumbs" aria-label="Breadcrumb">
          {current?.kind === 'database' && dbName !== undefined && (
            <span className="notion-crumb"><Table2 size={14} strokeWidth={1.5} /> {dbName || 'Untitled'}</span>
          )}
          {path.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <span className="notion-crumb-slash">/</span>}
              <button className="notion-crumb" onClick={() => open({ kind: 'page', id: item.id })}>
                <PageIcon page={item} size={14} /> <span className="truncate">{pageTitle(item)}</span>
              </button>
            </Fragment>
          ))}
        </nav>
      </div>
      {page && (
        <div className="notion-topbar-right no-drag">
          <button
            className="icon-button"
            aria-label={page.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            aria-pressed={page.favorite}
            onClick={() => changePage(page.id, (currentPage) => ({ ...currentPage, favorite: !currentPage.favorite }))}
          >
            <Star size={16} strokeWidth={1.75} className="notion-star" data-on={page.favorite} />
          </button>
          <button className="icon-button" aria-label="Page options" onClick={(event) => setMenu({ x: event.clientX - 180, y: event.clientY + 12 })}>
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
      {menu && page && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: 'Delete page',
              icon: <Trash2 size={15} strokeWidth={1.5} />,
              danger: true,
              onSelect: () => {
                if (page.parentId) open({ kind: 'page', id: page.parentId });
                else goBack();
                removePage(page.id);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

/** The Notion view's main area: top bar, then the open page or database. */
export function NotionMain() {
  const { items, error } = pages.useLoaded();
  const current = useNav((state) => state.current);
  const open = useNav((state) => state.open);
  const all = items ?? [];
  const page = current?.kind === 'page' ? (all.find((candidate) => candidate.id === current.id) ?? null) : null;

  let body;
  if (items === null) body = error ? <div className="db-error" role="alert">{error}</div> : <div className="spinner mx-auto mt-12" aria-label="Loading" />;
  else if (current?.kind === 'database') body = <DatabasePage key={current.id} id={current.id} />;
  else if (page) body = <PageView key={page.id} page={page} all={all} />;
  else {
    body = (
      <div className="notion-empty">
        <p>{current ? 'This page was deleted.' : 'Pick a page on the left, or start a new one.'}</p>
        <button className="db-button" onClick={() => open({ kind: 'page', id: addPage(null).id })}>
          <SquarePen size={15} strokeWidth={1.75} /> New page
        </button>
      </div>
    );
  }
  return (
    <div className="notion-main">
      <TopBar page={page} />
      {body}
    </div>
  );
}
