import { useEffect, useState } from 'react';
import type { PlanState } from '../../shared/plan';

/** The latest auto-schedule (Calendar and To-do both show it), kept in sync with every new plan. Null while loading. */
export function usePlan(): PlanState | null {
  const [plan, setPlan] = useState<PlanState | null>(null);
  useEffect(() => {
    // The first answer can arrive after a newer plan was broadcast; keep whichever was made last.
    const newest = (next: PlanState) => setPlan((current) => (current && (current.plannedAt ?? 0) > (next.plannedAt ?? 0) ? current : next));
    window.vision.plan.state().then(newest, () => setPlan(null));
    return window.vision.plan.onChange(setPlan);
  }, []);
  return plan;
}

/** "Tue 18:30" */
export function shortWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
