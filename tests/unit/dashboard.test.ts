import { describe, expect, it } from 'vitest';
import { arrangeCards, moveCard, normalizeDashboardPrefs, toggleCard } from '../../src/shared/dashboard';

const ALL = ['today', 'todos', 'focus', 'agents'];

describe('dashboard cards', () => {
  it('with no choices yet, every card shows in feature order', () => {
    expect(arrangeCards(ALL, { order: [], hidden: [] })).toEqual({ shown: ALL, hidden: [] });
  });

  it('follows the saved order; cards new since then join at the end', () => {
    expect(arrangeCards([...ALL, 'inbox'], { order: ['agents', 'today'], hidden: [] }).shown).toEqual(['agents', 'today', 'todos', 'focus', 'inbox']);
  });

  it('hidden cards are left out, and cards from removed features are forgotten', () => {
    expect(arrangeCards(ALL, { order: ['gone', 'focus'], hidden: ['todos', 'gone'] })).toEqual({ shown: ['focus', 'today', 'agents'], hidden: ['todos'] });
  });

  it('moving a card swaps it with its neighbour among the shown cards; at an end nothing changes', () => {
    const prefs = { order: [], hidden: ['focus'] };
    expect(arrangeCards(ALL, moveCard(ALL, prefs, 'agents', -1)).shown).toEqual(['today', 'agents', 'todos']);
    expect(arrangeCards(ALL, moveCard(ALL, prefs, 'today', -1)).shown).toEqual(['today', 'todos', 'agents']);
  });

  it('toggling hides a shown card and shows a hidden one', () => {
    const hidden = toggleCard({ order: [], hidden: [] }, 'focus');
    expect(hidden.hidden).toEqual(['focus']);
    expect(toggleCard(hidden, 'focus').hidden).toEqual([]);
  });

  it('bad saved data falls back to the defaults', () => {
    expect(normalizeDashboardPrefs('junk')).toEqual({ order: [], hidden: [] });
    expect(normalizeDashboardPrefs({ order: ['a', 3], hidden: null })).toEqual({ order: ['a'], hidden: [] });
  });
});
