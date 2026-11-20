import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { create } from 'zustand';
import { MAX_SEARCH_HITS, type SearchHit } from '../../../shared/fileSearch';
import { EntryIcon } from '../../../renderer/components/fileIcons';
import { openFile } from '../../../renderer/core/dockActions';
import { revealPath } from './revealPath';
import { useTree } from './treeStore';
import './file-search.css';

const DEBOUNCE_MS = 150;

interface SearchState {
  open: boolean;
  query: string;
  /** Bumped by ⌘P so the box takes focus again even when it is already open. */
  focusRequest: number;
  show: () => void;
  hide: () => void;
  setQuery: (query: string) => void;
}

export const useFileSearch = create<SearchState>((set) => ({
  open: false,
  query: '',
  focusRequest: 0,
  show: () => set((state) => ({ open: true, focusRequest: state.focusRequest + 1 })),
  hide: () => set({ open: false, query: '' }),
  setQuery: (query) => set({ query }),
}));

type Results = { status: 'idle' } | { status: 'searching'; hits: SearchHit[] } | { status: 'ready'; hits: SearchHit[] } | { status: 'error'; error: string };
type Answer = { query: string; hits: SearchHit[] } | { query: string; error: string };

/** Asks main as Dan types (debounced); an answer only counts for the text it was asked for. */
function useResults(query: string): Results {
  const [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      window.vision.fs.search(query).then(
        (result) => setAnswer(result.ok ? { query, hits: result.value } : { query, error: result.error }),
        () => setAnswer({ query, error: 'The search did not finish. Try again.' }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  if (!query.trim()) return { status: 'idle' };
  if (!answer || answer.query !== query) return { status: 'searching', hits: answer && 'hits' in answer ? answer.hits : [] };
  return 'error' in answer ? { status: 'error', error: answer.error } : { status: 'ready', hits: answer.hits };
}

/** A file opens in a tab (the search stays, to open more); a folder unfolds in the tree and the search closes. */
function openHit(hit: SearchHit): void {
  if (hit.isDirectory) {
    useFileSearch.getState().hide();
    void revealPath(hit.path);
  } else {
    useTree.getState().select(hit.path);
    openFile(hit.path);
  }
}

const parentOf = (relative: string) => relative.slice(0, Math.max(0, relative.lastIndexOf('/')));
const nameOf = (relative: string) => relative.slice(relative.lastIndexOf('/') + 1);

/** The search box under the Files header; while it has text, its results take the tree's place. */
export function FileSearch() {
  const { query, focusRequest, setQuery, hide } = useFileSearch();
  const results = useResults(query);
  const [picked, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = results.status === 'ready' || results.status === 'searching' ? results.hits : [];
  const active = Math.min(picked, Math.max(0, hits.length - 1));

  useEffect(() => inputRef.current?.focus(), [focusRequest]);
  useEffect(() => {
    document.querySelector('.file-search-results [data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (hits.length === 0 ? 0 : (index + step + hits.length) % hits.length));
    } else if (event.key === 'Enter' && hits[active]) {
      event.preventDefault();
      openHit(hits[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (query) {
        setQuery('');
        setActive(0);
      }
      else hide();
    }
  };

  return (
    <>
      <div className="file-search">
        <Search size={14} strokeWidth={1.75} className="shrink-0 text-(--color-text-faint)" aria-hidden />
        <input
          ref={inputRef}
          className="file-search-input"
          value={query}
          placeholder="Search files and folders"
          aria-label="Search files and folders"
          aria-controls="file-search-results"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {results.status === 'searching' && <div className="spinner file-search-spinner" aria-label="Searching" />}
        <button className="icon-button" style={{ width: 20, height: 20 }} title="Close search (Esc)" aria-label="Close search" onClick={hide}>
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>
      {query.trim() && (
        <div id="file-search-results" role="listbox" aria-label="Search results" className="file-search-results min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {results.status === 'error' && <div className="file-search-note" role="alert">{results.error}</div>}
          {results.status === 'ready' && hits.length === 0 && <div className="file-search-note">Nothing called “{query.trim()}” in this folder.</div>}
          {hits.map((hit, index) => (
            <div
              key={hit.path}
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              className="row file-search-hit"
              title={hit.relative}
              onMouseMove={() => setActive(index)}
              onClick={() => openHit(hit)}
            >
              <EntryIcon name={nameOf(hit.relative)} isDirectory={hit.isDirectory} />
              <span className="truncate">{nameOf(hit.relative)}</span>
              <span className="file-search-where truncate">{parentOf(hit.relative)}</span>
            </div>
          ))}
          {hits.length === MAX_SEARCH_HITS && <div className="file-search-note">Showing the first {MAX_SEARCH_HITS}. Type more to narrow it down.</div>}
        </div>
      )}
    </>
  );
}
