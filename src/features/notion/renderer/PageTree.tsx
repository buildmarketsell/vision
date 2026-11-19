import { useState, type MouseEvent, type ReactNode } from 'react';
import { create } from 'zustand';
import { ChevronRight, Copy, FileText, MoreHorizontal, Plus, Star, StarOff, Trash2 } from 'lucide-react';
import type { Page } from '../../../shared/pages';
import { pageTitle } from '../../../shared/pageOps';
import { ContextMenu, type ContextMenuItem } from '../../../renderer/components/ContextMenu';
import { addPage, changePage, removePage, useNav } from './pageStore';

const ICON = { size: 15, strokeWidth: 1.5 };
const EXPANDED_KEY = 'vision.notionExpanded';

function readExpanded(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Which pages are unfolded in the sidebar, remembered across launches. */
const useExpanded = create<{ open: Set<string>; toggle: (id: string, open?: boolean) => void }>((set, get) => ({
  open: new Set(readExpanded()),
  toggle: (id, open) => {
    const next = new Set(get().open);
    if (open ?? !next.has(id)) next.add(id);
    else next.delete(id);
    set({ open: next });
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembering is fine.
    }
  },
}));

export function PageIcon({ page, size = 15 }: { page: Pick<Page, 'icon'>; size?: number }) {
  return page.icon ? <span className="notion-emoji" style={{ fontSize: size }} aria-hidden>{page.icon}</span> : <FileText size={size} strokeWidth={1.5} aria-hidden />;
}

/** One sidebar row in Notion's style: icon (a chevron on hover), title, and "…" / "+" on hover. */
export function SidebarRow({ icon, label, active, onClick, onMenu, onAdd, chevron, depth = 0 }: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  onMenu?: (event: MouseEvent) => void;
  onAdd?: () => void;
  chevron?: { open: boolean; toggle: () => void };
  depth?: number;
}) {
  return (
    <div className="notion-row" data-active={active} style={{ paddingLeft: 8 + depth * 12 }} onContextMenu={onMenu}>
      {chevron ? (
        <button className="notion-row-icon" aria-label={chevron.open ? `Collapse ${label}` : `Expand ${label}`} onClick={chevron.toggle}>
          <span className="notion-row-glyph">{icon}</span>
          <ChevronRight size={14} strokeWidth={2} className="notion-row-chevron" data-open={chevron.open} aria-hidden />
        </button>
      ) : (
        <span className="notion-row-icon">{icon}</span>
      )}
      <button className="notion-row-label truncate" onClick={onClick}>{label}</button>
      {onMenu && (
        <button className="notion-row-action" aria-label={`More for ${label}`} onClick={onMenu}>
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
      )}
      {onAdd && (
        <button className="notion-row-action" aria-label={`Add a page inside ${label}`} onClick={onAdd}>
          <Plus size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function pageMenu(page: Page): ContextMenuItem[] {
  return [
    page.favorite
      ? { label: 'Remove from Favorites', icon: <StarOff {...ICON} />, onSelect: () => changePage(page.id, (current) => ({ ...current, favorite: false })) }
      : { label: 'Add to Favorites', icon: <Star {...ICON} />, onSelect: () => changePage(page.id, (current) => ({ ...current, favorite: true })) },
    {
      label: 'Duplicate',
      icon: <Copy {...ICON} />,
      onSelect: () => {
        const copy = addPage(page.parentId, `${pageTitle(page)} (copy)`);
        changePage(copy.id, (current) => ({ ...current, icon: page.icon, cover: page.cover, blocks: page.blocks.map((block) => ({ ...block, id: crypto.randomUUID() })) }));
      },
    },
    { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => removePage(page.id) },
  ];
}

/** The page tree: top-level pages, unfold to see the pages inside. Favorites show the starred ones flat. */
export function PageTree({ pages, roots, depth = 0 }: { pages: Page[]; roots: Page[]; depth?: number }) {
  const current = useNav((state) => state.current);
  const open = useNav((state) => state.open);
  const { open: expanded, toggle } = useExpanded();
  const [menu, setMenu] = useState<{ x: number; y: number; page: Page } | null>(null);
  return (
    <>
      {roots.map((page) => {
        const children = pages.filter((child) => child.parentId === page.id);
        const isOpen = expanded.has(page.id);
        return (
          <div key={page.id}>
            <SidebarRow
              icon={<PageIcon page={page} />}
              label={pageTitle(page)}
              depth={depth}
              active={current?.kind === 'page' && current.id === page.id}
              onClick={() => open({ kind: 'page', id: page.id })}
              chevron={{ open: isOpen, toggle: () => toggle(page.id) }}
              onMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, page });
              }}
              onAdd={() => {
                const child = addPage(page.id);
                toggle(page.id, true);
                open({ kind: 'page', id: child.id });
              }}
            />
            {isOpen &&
              (children.length ? (
                <PageTree pages={pages} roots={children} depth={depth + 1} />
              ) : (
                <div className="notion-row-empty" style={{ paddingLeft: 34 + (depth + 1) * 12 }}>No pages inside</div>
              ))}
          </div>
        );
      })}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={pageMenu(menu.page)} onClose={() => setMenu(null)} />}
    </>
  );
}
