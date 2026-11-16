import { useRef } from 'react';
import { RotateCw, Sparkles } from 'lucide-react';
import { baseName, useWorkspace } from '../../../renderer/core/workspaceStore';
import { useClaudeTerminal, type ClaudeStatus } from './useClaudeTerminal';

function statusLabel(status: ClaudeStatus): string {
  if (status.kind === 'starting') return 'Starting';
  if (status.kind === 'running') return 'Running';
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

function Header({ status, onRestart }: { status: ClaudeStatus; onRestart: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-4">
      <ClaudeIcon />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="font-semibold" style={{ fontSize: 'var(--size-title)' }}>Claude</span>
        <span className="text-(--color-text-muted)">· {statusLabel(status)}</span>
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

/** The Claude pane: a header and a dark card running the `claude` CLI in the open folder. */
export function ClaudePanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const folder = useWorkspace((state) => state.folder);
  const { status, restart } = useClaudeTerminal(hostRef);
  const isLive = status.kind === 'running';

  return (
    <div className="flex h-full flex-col bg-(--color-card)">
      <Header status={status} onRestart={() => void restart()} />
      <div className="relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--color-terminal-background)', borderRadius: 'var(--radius-inner)' }}>
        <div className="flex h-9 shrink-0 items-center gap-2 px-4" style={{ color: 'var(--color-terminal-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em' }}>
          {isLive && <span className="live-dot" />}
          <span>{isLive ? 'LIVE' : statusLabel(status).toUpperCase()}</span>
          <span className="ml-auto truncate" style={{ letterSpacing: 0 }}>{baseName(folder)}</span>
        </div>
        <div ref={hostRef} className="terminal-host min-h-0 flex-1" />
        <Overlay status={status} onRestart={() => void restart()} />
      </div>
    </div>
  );
}
