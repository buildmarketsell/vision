import { useState } from 'react';
import { Check } from 'lucide-react';
import { durationLabel, HOURS_NAMES, type PlanBlock, type PlanRisk } from '../../../shared/plan';
import { shortWhen } from '../../../renderer/core/usePlan';
import { clockTime } from './weekLayout';

const minutesOfDay = (ms: number) => {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
};

/** A planned block, clicked: what it's for, and Mark done (which takes it and the to-do's other blocks off the plan). */
export function BlockCard({ block, onClose }: { block: PlanBlock; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    window.vision.todos.update(block.taskId, { status: 'done' }).then(onClose, () => setError('That did not save. Try again.'));
  };
  const hours = HOURS_NAMES.find((item) => item.value === block.hours)?.label ?? '';
  return (
    <div className="calendar-new plan-block-card" role="dialog" aria-label="Planned task" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="plan-block-title">{block.title}</div>
      <div className="caption">
        {new Date(block.start).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}, {clockTime(minutesOfDay(block.start))} – {clockTime(minutesOfDay(block.end))} · {durationLabel((block.end - block.start) / 60_000)} · {hours}
      </div>
      <p className="caption">Planned by VISION. It moves on its own when your calendar or to-dos change.</p>
      {error && <div className="calendar-error" role="alert">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" className="button-secondary" onClick={onClose}>Close</button>
        <button type="button" className="button-primary" autoFocus onClick={done}>
          <Check size={14} strokeWidth={2} /> Mark done
        </button>
      </div>
    </div>
  );
}

function riskLine(risk: PlanRisk): string {
  if (risk.kind === 'time-used') return 'All its planned time has passed. Mark it done, or give it more time.';
  if (risk.kind === 'no-room') return `${durationLabel(risk.unplannedMinutes)} doesn't fit in the next two weeks.`;
  const due = risk.deadline === null ? '' : `due ${shortWhen(risk.deadline)}`;
  if (risk.unplannedMinutes > 0) return `${durationLabel(risk.unplannedMinutes)} won't fit before it's ${due}.`;
  return `Finishes ${risk.plannedEnd === null ? 'late' : shortWhen(risk.plannedEnd)}, ${due}.`;
}

/** The to-dos the plan can't fit, and what to do about it. */
export function RiskList({ risks, onClose }: { risks: PlanRisk[]; onClose: () => void }) {
  return (
    <div className="calendar-new plan-risks" role="dialog" aria-label="At risk" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="plan-block-title">{risks.length === 1 ? '1 to-do at risk' : `${risks.length} to-dos at risk`}</div>
      <ul className="plan-risk-list">
        {risks.map((risk) => (
          <li key={risk.taskId}>
            <span className="plan-risk-name">{risk.title}</span>
            <span className="caption">{riskLine(risk)}</span>
          </li>
        ))}
      </ul>
      <p className="caption">Move a deadline, shorten a task, lower another one's priority, or add hours in Plan settings.</p>
      <div className="flex justify-end">
        <button type="button" className="button-secondary" autoFocus onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
