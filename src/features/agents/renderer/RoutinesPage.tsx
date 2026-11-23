import { useState } from 'react';
import { Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import { describeSchedule, ROUTINE_REPEATS, WEEKDAY_NAMES, type Routine, type RoutineInput, type RoutineRepeat } from '../../../shared/routines';
import { timeAgo } from '../../../renderer/core/timeAgo';
import { AgentFace } from './AgentFace';
import { useAgents } from './agentsStore';

const REPEAT_LABELS: Record<RoutineRepeat, string> = { daily: 'Every day', weekdays: 'Weekdays', weekly: 'Weekly' };

function RoutineForm({ onDone }: { onDone: () => void }) {
  const agents = useAgents((store) => store.agents) ?? [];
  const [draft, setDraft] = useState<RoutineInput>({ agentId: agents[0]?.id ?? '', prompt: '', repeat: 'weekdays', time: '09:00', weekday: 1 });
  const save = async () => {
    await window.vision.routines.save(draft);
    onDone();
  };
  return (
    <div className="agent-card" data-tone="question">
      <div className="agent-card-body routine-form">
        <label className="agent-label">
          Agent
          <select className="agent-field" value={draft.agentId} onChange={(event) => setDraft({ ...draft, agentId: event.target.value })}>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <label className="agent-label">
          What to tell it
          <textarea className="agent-field" rows={3} autoFocus value={draft.prompt} placeholder="Check yesterday's Meta ads and tell me what to change." onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} />
        </label>
        <div className="routine-when">
          <div className="segmented" role="radiogroup" aria-label="Repeat">
            {ROUTINE_REPEATS.map((repeat) => (
              <button key={repeat} role="radio" aria-checked={draft.repeat === repeat} data-active={draft.repeat === repeat} onClick={() => setDraft({ ...draft, repeat })}>
                {REPEAT_LABELS[repeat]}
              </button>
            ))}
          </div>
          {draft.repeat === 'weekly' && (
            <select className="agent-field" aria-label="Day" value={draft.weekday} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>
              {WEEKDAY_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
          )}
          <input className="agent-field" type="time" aria-label="Time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
        </div>
      </div>
      <div className="agent-card-lip">
        <span className="agent-card-hint">Runs while VISION is open; a missed run happens when it opens.</span>
        <span className="flex-1" />
        <button className="agent-button" data-kind="secondary" onClick={onDone}>Cancel</button>
        <button className="agent-button" data-kind="primary" disabled={!draft.agentId || !draft.prompt?.trim()} onClick={() => void save()}>Add routine</button>
      </div>
    </div>
  );
}

function RoutineRow({ routine }: { routine: Routine }) {
  const agent = useAgents((store) => store.agents?.find((item) => item.id === routine.agentId));
  if (!agent) return null;
  return (
    <div className="routine-row" data-enabled={routine.enabled}>
      <AgentFace face={agent.face} mood={routine.enabled ? 'idle' : 'sleeping'} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate">{routine.prompt}</div>
        <div className="agent-muted">
          {agent.name} · {describeSchedule(routine)}
          {routine.lastRunAt ? ` · last ran ${timeAgo(routine.lastRunAt)}` : ''}
          {!routine.enabled && ' · paused'}
        </div>
      </div>
      <button className="agents-icon-button" aria-label="Run now" title="Run now" onClick={() => void window.vision.routines.runNow(routine.id)}><Zap size={15} strokeWidth={1.75} /></button>
      <button className="agents-icon-button" aria-label={routine.enabled ? 'Pause' : 'Resume'} title={routine.enabled ? 'Pause' : 'Resume'} onClick={() => void window.vision.routines.save({ id: routine.id, enabled: !routine.enabled })}>
        {routine.enabled ? <Pause size={15} strokeWidth={1.75} /> : <Play size={15} strokeWidth={1.75} />}
      </button>
      <button className="agents-icon-button" data-tone="destructive" aria-label="Delete routine" title="Delete" onClick={() => void window.vision.routines.remove(routine.id)}><Trash2 size={15} strokeWidth={1.75} /></button>
    </div>
  );
}

/** Messages agents get on a schedule. */
export function RoutinesPage() {
  const routines = useAgents((store) => store.routines);
  const hasAgents = (useAgents((store) => store.agents) ?? []).length > 0;
  const [adding, setAdding] = useState(false);
  return (
    <div className="agent-page">
      <div className="agent-column">
        <div className="agent-page-head">
          <h1 className="agent-page-title">Routines</h1>
          <button className="agent-button" data-kind="primary" disabled={!hasAgents || adding} onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={2} /> New routine
          </button>
        </div>
        {adding && <RoutineForm onDone={() => setAdding(false)} />}
        {routines.map((routine) => <RoutineRow key={routine.id} routine={routine} />)}
        {routines.length === 0 && !adding && (
          <div className="agent-empty">
            <AgentFace face={{ shape: 'cloud', colour: 1 }} mood="sleeping" size={64} />
            <div className="agent-muted">{hasAgents ? 'No routines yet. Give an agent something to do every morning.' : 'Make an agent first.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
