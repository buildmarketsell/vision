import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { theme } from '../../../renderer/theme';
import { useTerminalTheme, xtermTheme } from '../../../renderer/core/terminalTheme';
import { setPanelTitle } from '../../../renderer/core/dockActions';
import { cleanTitle, useClaudeSessions } from './sessionsStore';

export type ClaudeStatus =
  | { kind: 'starting' }
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number }
  | { kind: 'failed'; message: string; notInstalled: boolean };

/** How long after the last output a session still counts as working. */
const BUSY_TIMEOUT_MS = 1200;
/** Output this soon after a key press is just the echo of typing, not Claude working. */
const TYPING_ECHO_MS = 500;

const terminals = new Map<string, Terminal>();

/** Puts the keyboard in a session's terminal. */
export function focusClaudeTerminal(panelId: string): void {
  terminals.get(panelId)?.focus();
}

function createTerminal(): Terminal {
  const { font } = theme;
  return new Terminal({
    fontFamily: font.mono,
    fontSize: font.sizeTerminal,
    lineHeight: 1.25,
    cursorBlink: true,
    scrollback: 5000,
    macOptionIsMeta: true,
    theme: xtermTheme(useTerminalTheme.getState().appearance),
  });
}

function sessionStatusOf(status: ClaudeStatus) {
  if (status.kind === 'exited') return 'stopped' as const;
  return status.kind === 'failed' ? ('failed' as const) : status.kind;
}

/** Marks the session busy while output flows, idle shortly after it stops. */
function busyTracker(panelId: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const update = useClaudeSessions.getState().update;
  return {
    ping() {
      update(panelId, { busy: true });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => update(panelId, { busy: false }), BUSY_TIMEOUT_MS);
    },
    stop() {
      if (timer) clearTimeout(timer);
    },
  };
}

/** Runs `claude` in the open folder inside an xterm.js terminal mounted on `hostRef`. */
export function useClaudeTerminal(hostRef: RefObject<HTMLDivElement | null>, panelId: string, resumeSessionId: string | null) {
  const [status, setStatusState] = useState<ClaudeStatus>({ kind: 'starting' });
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);

  const setStatus = useCallback(
    (next: ClaudeStatus) => {
      setStatusState(next);
      useClaudeSessions.getState().update(panelId, { status: sessionStatusOf(next), busy: false });
    },
    [panelId],
  );

  const start = useCallback(async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    if (ptyIdRef.current !== null) window.vision.pty.kill(ptyIdRef.current);
    ptyIdRef.current = null;
    terminal.reset();
    setStatus({ kind: 'starting' });
    fitRef.current?.fit();
    const result = await window.vision.pty.start(terminal.cols, terminal.rows, resumeSessionId ?? undefined);
    if (!result.ok) {
      setStatus({ kind: 'failed', message: result.message, notInstalled: result.reason === 'not-found' });
      return;
    }
    ptyIdRef.current = result.id;
    setStatus({ kind: 'running' });
    terminal.focus();
  }, [setStatus, resumeSessionId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const terminal = createTerminal();
    const fit = new FitAddon();
    const busy = busyTracker(panelId);
    terminal.loadAddon(fit);
    terminal.open(host);
    terminalRef.current = terminal;
    fitRef.current = fit;
    terminals.set(panelId, terminal);

    let lastInputAt = 0;
    const input = terminal.onData((data) => {
      lastInputAt = Date.now();
      if (ptyIdRef.current !== null) window.vision.pty.write(ptyIdRef.current, data);
    });
    const titleChange = terminal.onTitleChange((raw) => {
      const title = cleanTitle(raw);
      useClaudeSessions.getState().update(panelId, { title });
      setPanelTitle(panelId, title);
    });
    const offData = window.vision.pty.onData(({ id, data }) => {
      if (id !== ptyIdRef.current) return;
      terminal.write(data);
      if (Date.now() - lastInputAt > TYPING_ECHO_MS) busy.ping();
    });
    const offExit = window.vision.pty.onExit(({ id, exitCode }) => {
      if (id !== ptyIdRef.current) return;
      ptyIdRef.current = null;
      busy.stop();
      setStatus({ kind: 'exited', exitCode });
    });
    const resizeObserver = new ResizeObserver(() => {
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      fit.fit();
      if (ptyIdRef.current !== null) window.vision.pty.resize(ptyIdRef.current, terminal.cols, terminal.rows);
    });
    resizeObserver.observe(host);
    const offTheme = useTerminalTheme.subscribe((state) => {
      terminal.options.theme = xtermTheme(state.appearance);
    });
    void start();

    return () => {
      resizeObserver.disconnect();
      offTheme();
      busy.stop();
      input.dispose();
      titleChange.dispose();
      offData();
      offExit();
      if (ptyIdRef.current !== null) window.vision.pty.kill(ptyIdRef.current);
      ptyIdRef.current = null;
      terminals.delete(panelId);
      terminal.dispose();
    };
  }, [hostRef, panelId, start, setStatus]);

  return { status, restart: start };
}
