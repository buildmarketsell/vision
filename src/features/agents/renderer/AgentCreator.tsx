import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder } from 'lucide-react';
import { faceFromName, type AgentFace as Face } from '../../../shared/agents';
import { useWorkspace } from '../../../renderer/core/workspaceStore';
import { AgentFace } from './AgentFace';
import { FacePicker } from './FacePicker';
import { useAgents } from './agentsStore';

/** Bupsy's bot creator: the face on its tinted, dotted stage, then name, job and folder. Esc or Cancel closes it. */
export function AgentCreator() {
  const setOpen = useAgents((store) => store.setCreatorOpen);
  const go = useAgents((store) => store.go);
  const workspaceFolder = useWorkspace((state) => state.folder);
  const [name, setName] = useState('');
  const [job, setJob] = useState('');
  const [folder, setFolder] = useState<string | null>(workspaceFolder);
  const [face, setFace] = useState<Face | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownFace = face ?? faceFromName(name.trim() || 'Agent');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const create = async () => {
    if (!name.trim() || !folder) return;
    const agent = await window.vision.agents.create({ name: name.trim(), job, folder, face: shownFace });
    if (!agent) {
      setError('Could not create it. Check the folder still exists.');
      return;
    }
    setOpen(false);
    go({ kind: 'agent', id: agent.id });
  };

  return createPortal(
    <div className="agent-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="agent-sheet" role="dialog" aria-label="New agent" aria-modal="true">
        <div className="agent-stage">
          <AgentFace face={shownFace} mood="done" size={96} />
        </div>
        <div className="agent-sheet-body">
          <FacePicker face={shownFace} onChange={setFace} />
          <label className="agent-label">
            Name
            <input className="agent-field" autoFocus value={name} maxLength={40} placeholder="Nurve" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void create()} />
          </label>
          <label className="agent-label">
            Job
            <textarea className="agent-field" rows={4} value={job} placeholder="What it is for, in your words. Kept short: it is sent with every message." onChange={(event) => setJob(event.target.value)} />
          </label>
          <div className="agent-label">
            Folder
            <button className="agent-folder" onClick={() => void window.vision.agents.pickFolder().then((picked) => picked && setFolder(picked))}>
              <Folder size={14} strokeWidth={1.75} />
              <span className="truncate">{folder ?? 'Choose a folder…'}</span>
            </button>
          </div>
          {error && <div className="agent-notice" data-tone="error" role="alert">{error}</div>}
        </div>
        <div className="agent-sheet-lip">
          <span className="agent-keycap">esc</span>
          <span className="agent-muted">to cancel</span>
          <span className="flex-1" />
          <button className="agent-button" data-kind="secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button className="agent-button" data-kind="primary" disabled={!name.trim() || !folder} onClick={() => void create()}>Create agent</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
