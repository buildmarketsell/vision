import { useRef } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { RotateCw, Sparkles } from 'lucide-react';
import type { TabParams } from '../../../renderer/core/feature';
import { baseName, useWorkspace } from '../../../renderer/core/workspaceStore';
import { useClaudeSessions } from './sessionsStore';
import { useClaudeTerminal, type ClaudeStatus } from './useClaudeTerminal';

function statusLabel(status: ClaudeStatus, busy: boolean): string {
  if (status.kind === 'starting') return 'Starting';
  if (status.kind === 'running') return busy ? 'Working' : 'Ready';
  if (status.kind === 'exited') return 'Stopped';
  return status.notInstalled ? 'Not installed' : 'Did not start';
}

export function ClaudeIcon({ size = 28 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--color-accent)' }}
    >
      <Sparkles size={size * 0.55} strokeWidth={2} color="white" />
    </span>
  );
}

function Header({ title, label, onRestart }: { title: string; label: string; onRestart: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-4">
      <ClaudeIcon />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-semibold" style={{ fontSize: 'var(--size-title)' }}>{title}</span>
        <span className="shrink-0 text-(--color-text-muted)">· {label}</span>
      </div>
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
  const folder = useWorkspace((state) => state.folder);
  const session = useClaudeSessions((state) => state.sessions[api.id]);
  const { status, restart } = useClaudeTerminal(hostRef, api.id);
  const busy = session?.busy === true;
  const label = statusLabel(status, busy);

  return (
    <div className="flex h-full flex-col bg-(--color-card)">
      <Header title={session?.title ?? 'Claude'} label={label} onRestart={() => void restart()} />
      <div className="relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--color-terminal-background)', borderRadius: 'var(--radius-inner)' }}>
        <div className="flex h-9 shrink-0 items-center gap-2 px-4" style={{ color: 'var(--color-terminal-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em' }}>
          {status.kind === 'running' && <span className="live-dot" style={busy ? undefined : { animation: 'none', opacity: 0.5 }} />}
          <span>{busy ? 'LIVE' : label.toUpperCase()}</span>
          <span className="ml-auto truncate" style={{ letterSpacing: 0 }}>{baseName(folder)}</span>
        </div>
        <div ref={hostRef} className="terminal-host min-h-0 flex-1" />
        <Overlay status={status} onRestart={() => void restart()} />
      </div>
    </div>
  );
}
