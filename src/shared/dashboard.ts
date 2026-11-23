/** Which Dashboard cards show and in what order. Card ids come from the features; Dan's choices are saved per Mac. */

export interface DashboardPrefs {
  /** Card ids in Dan's order; cards not listed follow in feature order. */
  order: string[];
  hidden: string[];
}

export function normalizeDashboardPrefs(raw: unknown): DashboardPrefs {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const ids = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  return { order: ids(record['order']), hidden: ids(record['hidden']) };
}

function ordered(all: string[], prefs: DashboardPrefs): string[] {
  const known = prefs.order.filter((id) => all.includes(id));
  return [...known, ...all.filter((id) => !known.includes(id))];
}

export function arrangeCards(all: string[], prefs: DashboardPrefs): { shown: string[]; hidden: string[] } {
  const order = ordered(all, prefs);
  return { shown: order.filter((id) => !prefs.hidden.includes(id)), hidden: order.filter((id) => prefs.hidden.includes(id)) };
}

/** Moves a card one place up (-1) or down (+1) among the shown cards. */
export function moveCard(all: string[], prefs: DashboardPrefs, id: string, step: -1 | 1): DashboardPrefs {
  const order = ordered(all, prefs);
  const shown = order.filter((item) => !prefs.hidden.includes(item));
  const neighbour = shown[shown.indexOf(id) + step];
  if (!shown.includes(id) || !neighbour) return { ...prefs, order };
  const from = order.indexOf(id);
  const to = order.indexOf(neighbour);
  const next = [...order];
  next[from] = neighbour;
  next[to] = id;
  return { ...prefs, order: next };
}

export function toggleCard(prefs: DashboardPrefs, id: string): DashboardPrefs {
  return { ...prefs, hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((item) => item !== id) : [...prefs.hidden, id] };
}
