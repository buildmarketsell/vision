import { useState } from 'react';
import { Folder, MessageSquarePlus, Pin, X } from 'lucide-react';
import { TRUST_LABELS, TRUST_LEVELS, type Agent, type AgentChange } from '../../../shared/agents';
import { AgentFace } from './AgentFace';
import { FacePicker } from './FacePicker';
import { moodOf, useAgents } from './agentsStore';

const MODELS = [
  { value: 'default', label: 'Default (Claude Code decides)' },
  { value: 'opus', label: 'Opus: deepest work' },
  { value: 'sonnet', label: 'Sonnet: fast, fewer tokens' },
  { value: 'haiku', label: 'Haiku: quickest, cheapest' },
];

/** Text that saves when you leave the field, so typing never restarts the agent mid-word. */
function TextSetting({ label, value, rows, max, onSave }: { label: string; value: string; rows?: number; max: number; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  // Saved from elsewhere (another window, a rename): show the new value.
  if (value !== saved) {
    setSaved(value);
    setDraft(value);
  }
  const save = () => draft !== value && onSave(draft);
  return (
    <label className="agent-label">
      {label}
      {rows ? (
        <textarea className="agent-field" rows={rows} maxLength={max} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save} />
      ) : (
        <input className="agent-field" maxLength={max} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save} onKeyDown={(event) => event.key === 'Enter' && save()} />
      )}
    </label>
  );
}

/** Bupsy's bot page as a side panel: face, name, job, folder, model, trust, then Fresh chat and Delete. */
export function AgentDetails({ agent }: { agent: Agent }) {
  const status = useAgents((store) => store.statuses[agent.id]);
  const setOpen = useAgents((store) => store.setDetailsOpen);
  const go = useAgents((store) => store.go);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const change = (next: AgentChange) => void window.vision.agents.update(agent.id, next);

  return (
    <aside className="agent-details" aria-label={`${agent.name} details`}>
      <div className="agent-details-head">
        <AgentFace face={agent.face} mood={moodOf(agent, status)} size={44} />
        <div className="min-w-0 flex-1">
          <div className="agent-details-name truncate">{agent.name}</div>
          <div className="agent-muted truncate">{agent.role || 'No role'}</div>
        </div>
        <button className="agents-icon-button" aria-label="Close details" title="Close" onClick={() => setOpen(false)}>
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="agent-details-body">
        <FacePicker face={agent.face} onChange={(face) => change({ face })} />
        <TextSetting label="Name" value={agent.name} max={40} onSave={(name) => name.trim() && change({ name: name.trim() })} />
        <TextSetting label="Role" value={agent.role} max={20} onSave={(role) => change({ role: role.trim() })} />
        <TextSetting label="Job" value={agent.job} rows={6} max={4000} onSave={(job) => change({ job })} />
        <div className="agent-label">
          Folder
          <button className="agent-folder" onClick={() => void window.vision.agents.pickFolder().then((folder) => folder && change({ folder }))}>
            <Folder size={14} strokeWidth={1.75} />
            <span className="truncate">{agent.folder}</span>
          </button>
        </div>
        <label className="agent-label">
          Model
          <select className="agent-field" value={agent.model} onChange={(event) => change({ model: event.target.value })}>
            {MODELS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
          </select>
        </label>
        <div className="agent-label" role="radiogroup" aria-label="Trust level">
          Trust level
          {TRUST_LEVELS.map((level) => (
            <button key={level} role="radio" aria-checked={agent.trust === level} className="agent-trust" data-selected={agent.trust === level} onClick={() => change({ trust: level })}>
              <span>{TRUST_LABELS[level].title}</span>
              <span className="agent-muted">{TRUST_LABELS[level].detail}</span>
            </button>
          ))}
        </div>
        <TextSetting label="Section in the list" value={agent.group} max={40} onSave={(group) => change({ group: group.trim() })} />
        <button className="agent-button" data-kind="secondary" onClick={() => change({ pinned: !agent.pinned })}>
          <Pin size={14} strokeWidth={1.75} /> {agent.pinned ? 'Unpin' : 'Pin to the top'}
        </button>
        <div className="agent-label">
          Long chat?
          <button className="agent-button" data-kind="secondary" disabled={status?.phase === 'working'} onClick={() => window.vision.agents.freshChat(agent.id)}>
            <MessageSquarePlus size={14} strokeWidth={1.75} /> Fresh chat
          </button>
          <span className="agent-muted">{agent.name} writes a short handoff note, then starts clean. Every message after costs fewer tokens.</span>
          {agent.handoffNote && <pre className="agent-note">{agent.handoffNote}</pre>}
        </div>
        {confirmDelete ? (
          <div className="agent-confirm" role="alert">
            <span>Delete {agent.name} and its routines? Its chat stays in Claude Code's history.</span>
            <button className="agent-button" data-kind="destructive" onClick={() => void window.vision.agents.remove(agent.id).then(() => { setOpen(false); go({ kind: 'none' }); })}>Delete</button>
            <button className="agent-button" data-kind="ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
          </div>
        ) : (
          <button className="agent-button" data-kind="ghost-destructive" onClick={() => setConfirmDelete(true)}>Delete agent</button>
        )}
      </div>
    </aside>
  );
}
