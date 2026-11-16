import { useRef } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { RotateCw } from 'lucide-react';
import { ClaudeLogo } from '../../../renderer/components/ClaudeLogo';
import type { TabParams } from '../../../renderer/core/feature';
import { useClaudeSessions } from './sessionsStore';
import { useClaudeTerminal, type ClaudeStatus } from './useClaudeTerminal';

function statusLabel(status: ClaudeStatus, busy: boolean): string {
  if (status.kind === 'starting') return 'Starting';
  if (status.kind === 'running') return busy ? 'Working' : 'Ready';
  if (status.kind === 'exited') return 'Stopped';
  return status.notInstalled ? 'Not installed' : 'Did not start';
}

/** Status pill: pulsing orange "Working" while Claude prints, calm gray otherwise. */
function StatusPill({ label, busy, live }: { label: string; busy: boolean; live: boolean }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 caption"
      style={{ background: busy ? 'var(--color-accent-soft)' : 'var(--color-row-hover)', color: busy ? 'var(--color-accent-hover)' : undefined }}
    >
      {live && <span className="live-dot" data-busy={busy} />}
      {label}
    </span>
  );
}

function Header({ title, label, busy, live, onRestart }: { title: string; label: string; busy: boolean; live: boolean; onRestart: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 pr-2 pl-4">
      <ClaudeLogo size={22} busy={busy} dim={!live} />
      <span className="title min-w-0 truncate">{title}</span>
      <StatusPill label={label} busy={busy} live={live} />
      <span className="flex-1" />
      <button className="icon-button" title="Restart Claude" aria-label="Restart Claude" onClick={onRestart}>
        <RotateCw size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Overlay({ status, onRestart }: { status: ClaudeStatus; onRestart: () => void }) {
  if (status.kind === 'running') return null;
  if (status.kind === 'starting') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="spinner" aria-label="Starting Claude" />
      </div>
    );
  }
  const message = status.kind === 'exited' ? `Claude stopped (exit code ${status.exitCode}).` : status.message;
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--color-terminal-text)' }}>
      <span className="flex-1">{message}</span>
      <button className="button-primary" style={{ height: 30 }} onClick={onRestart}>
        {status.kind === 'failed' && status.notInstalled ? 'Try Again' : 'Restart Claude'}
      </button>
    </div>
  );
}

/** One Claude session: a header and a dark card running the `claude` CLI in the open folder. */
export function ClaudePanel({ api }: IDockviewPanelProps<TabParams>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const session = useClaudeSessions((state) => state.sessions[api.id]);
  const { status, restart } = useClaudeTerminal(hostRef, api.id);
  const busy = session?.busy === true;
  const label = statusLabel(status, busy);

  return (
    <div className="flex h-full flex-col bg-(--color-card)">
      <Header title={session?.title ?? 'Claude'} label={label} busy={busy} live={status.kind === 'running'} onRestart={() => void restart()} />
      <div className="relative mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden pt-1" style={{ background: 'var(--color-terminal-background)', borderRadius: 'var(--radius-inner)' }}>
        <div ref={hostRef} className="terminal-host min-h-0 flex-1" />
        <Overlay status={status} onRestart={() => void restart()} />
      </div>
    </div>
  );
}
