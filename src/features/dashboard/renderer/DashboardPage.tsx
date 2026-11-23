import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import { arrangeCards, moveCard, normalizeDashboardPrefs, toggleCard, type DashboardPrefs } from '../../../shared/dashboard';
import { allDashboardCards } from '../../../renderer/core/featureIndex';
import { useActiveViewStore } from '../../../renderer/core/activeView';
import { ErrorBoundary } from '../../../renderer/components/ErrorBoundary';
import type { DashboardCard } from '../../../renderer/core/feature';
import { useNow } from '../../../renderer/core/useNow';
import './dashboard.css';

const PREFS_KEY = 'vision.dashboard';
/** The day first, then what needs doing; until Dan reorders. Cards not listed follow in menu order. */
const DEFAULT_ORDER = ['today', 'todos', 'agents', 'focus', 'usage', 'content', 'inbox'];
const rank = (id: string) => (DEFAULT_ORDER.includes(id) ? DEFAULT_ORDER.indexOf(id) : DEFAULT_ORDER.length);

function readPrefs(): DashboardPrefs {
  try {
    return normalizeDashboardPrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null'));
  } catch {
    return normalizeDashboardPrefs(null);
  }
}

function savePrefs(prefs: DashboardPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not remembering the layout is fine; it still changes now.
  }
}

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 19 ? 'Good afternoon' : 'Good evening';
}

function Card({ card, editing, first, last, onMove, onHide }: { card: DashboardCard; editing: boolean; first: boolean; last: boolean; onMove: (step: -1 | 1) => void; onHide: () => void }) {
  const select = useActiveViewStore((state) => state.select);
  const Body = card.component;
  return (
    <section className="dash-card" data-wide={card.wide ?? false} aria-label={card.title}>
      <header className="dash-card-head">
        <button className="dash-card-title" disabled={!card.view} onClick={() => card.view && select(card.view)}>
          {card.icon}
          {card.title}
        </button>
        {editing && (
          <span className="dash-card-tools">
            <button className="icon-button" aria-label={`Move ${card.title} up`} disabled={first} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
            <button className="icon-button" aria-label={`Move ${card.title} down`} disabled={last} onClick={() => onMove(1)}><ArrowDown size={14} /></button>
            <button className="icon-button" aria-label={`Hide ${card.title}`} onClick={onHide}><EyeOff size={14} /></button>
          </span>
        )}
      </header>
      <div className="dash-card-body">
        <ErrorBoundary name={card.title}>
          <Body />
        </ErrorBoundary>
      </div>
    </section>
  );
}

/** The Dashboard: a card from each feature (today, to-dos, focus, agents, usage, content, inbox), shown and ordered as Dan chooses. */
export function DashboardPage() {
  const cards = [...allDashboardCards()].sort((a, b) => rank(a.id) - rank(b.id));
  const ids = cards.map((card) => card.id);
  const [prefs, setPrefs] = useState(readPrefs);
  const [editing, setEditing] = useState(false);
  const { shown, hidden } = arrangeCards(ids, prefs);
  const byId = (id: string) => cards.find((card) => card.id === id);
  const update = (next: DashboardPrefs) => {
    setPrefs(next);
    savePrefs(next);
  };
  const now = new Date(useNow());

  return (
    <div className="dash-page">
      <div className="page-column" data-width="wide">
        <LayoutDashboard size={30} strokeWidth={1.5} className="dash-icon" aria-hidden />
        <h1 className="page-title">{greeting(now)}</h1>
        <div className="dash-controls">
          <span className="caption">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button className="button-secondary" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <SlidersHorizontal size={14} strokeWidth={1.75} /> {editing ? 'Done' : 'Customize'}
          </button>
        </div>
        {editing && hidden.length > 0 && (
          <div className="dash-hidden" aria-label="Hidden cards">
            <span className="caption">Hidden:</span>
            {hidden.map((id) => (
              <button key={id} className="pill-button" onClick={() => update(toggleCard(prefs, id))}>
                <Eye size={13} /> {byId(id)?.title}
              </button>
            ))}
          </div>
        )}
        <div className="dash-grid">
          {shown.map((id, index) => {
            const card = byId(id);
            return card ? (
              <Card
                key={id}
                card={card}
                editing={editing}
                first={index === 0}
                last={index === shown.length - 1}
                onMove={(step) => update(moveCard(ids, prefs, id, step))}
                onHide={() => update(toggleCard(prefs, id))}
              />
            ) : null;
          })}
        </div>
        {shown.length === 0 && <div className="caption dash-empty">Every card is hidden. Customize to bring some back.</div>}
      </div>
    </div>
  );
}
