import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { theme } from '../../../renderer/theme';

export type ClaudeStatus =
  | { kind: 'starting' }
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number }
  | { kind: 'failed'; message: string; notInstalled: boolean };

let focusedTerminal: Terminal | null = null;

/** Puts the keyboard in the Claude terminal (used by the "Ask Claude" button). */
export function focusClaudeTerminal(): void {
  focusedTerminal?.focus();
}

function createTerminal(): Terminal {
  const { colors, font } = theme;
  return new Terminal({
    fontFamily: font.mono,
    fontSize: font.sizeTerminal,
    lineHeight: 1.25,
    cursorBlink: true,
    allowProposedApi: false,
    scrollback: 5000,
    macOptionIsMeta: true,
    theme: {
      background: colors.terminalBackground,
      foreground: colors.terminalText,
      cursor: colors.accent,
      cursorAccent: colors.terminalBackground,
      selectionBackground: '#F26B3A55',
    },
  });
}

/** Runs `claude` in the open folder inside an xterm.js terminal mounted on `hostRef`. */
export function useClaudeTerminal(hostRef: RefObject<HTMLDivElement | null>) {
  const [status, setStatus] = useState<ClaudeStatus>({ kind: 'starting' });
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<number | null>(null);

  const start = useCallback(async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    if (ptyIdRef.current !== null) window.vision.pty.kill(ptyIdRef.current);
    ptyIdRef.current = null;
    terminal.reset();
    setStatus({ kind: 'starting' });
    fitRef.current?.fit();
    const result = await window.vision.pty.start(terminal.cols, terminal.rows);
    if (!result.ok) {
      setStatus({ kind: 'failed', message: result.message, notInstalled: result.reason === 'not-found' });
      return;
    }
    ptyIdRef.current = result.id;
    setStatus({ kind: 'running' });
    terminal.focus();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const terminal = createTerminal();
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    terminalRef.current = terminal;
    fitRef.current = fit;
    focusedTerminal = terminal;

    const input = terminal.onData((data) => {
      if (ptyIdRef.current !== null) window.vision.pty.write(ptyIdRef.current, data);
    });
    const offData = window.vision.pty.onData(({ id, data }) => id === ptyIdRef.current && terminal.write(data));
    const offExit = window.vision.pty.onExit(({ id, exitCode }) => {
      if (id !== ptyIdRef.current) return;
      ptyIdRef.current = null;
      setStatus({ kind: 'exited', exitCode });
    });
    const resizeObserver = new ResizeObserver(() => {
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      fit.fit();
      if (ptyIdRef.current !== null) window.vision.pty.resize(ptyIdRef.current, terminal.cols, terminal.rows);
    });
    resizeObserver.observe(host);
    void start();

    return () => {
      resizeObserver.disconnect();
      input.dispose();
      offData();
      offExit();
      if (ptyIdRef.current !== null) window.vision.pty.kill(ptyIdRef.current);
      ptyIdRef.current = null;
      if (focusedTerminal === terminal) focusedTerminal = null;
      terminal.dispose();
    };
  }, [hostRef, start]);

  return { status, restart: start };
}
