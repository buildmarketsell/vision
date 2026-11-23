import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarClock, Check, Pause, Play, Plus, Square, Video, X } from 'lucide-react';
import type { FocusAction } from '../../../shared/focus';
import { MORE_TIME_CHOICES } from '../../../shared/focus';
import type { Glance } from '../../../shared/glance';
import type { IslandUpdate } from '../../../shared/ipc';

/** Leaving the island closes it after this long, like the menus' peek, so a pointer passing by doesn't flicker it. */
const CLOSE_DELAY_MS = 250;
const ICON = { size: 14, strokeWidth: 2 } as const;

const act = (action: FocusAction) => void window.vision.focus.act(action);
const moreLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hour' : `${minutes / 60} hours`);

/** How far through a countdown, as a ring; a stopwatch's ring is a slow spinner instead. */
function Ring({ progress, paused }: { progress: number | null; paused: boolean }) {
  const length = 2 * Math.PI * 7;
  return (
    <svg className="island-ring" data-spinning={progress === null && !paused} data-paused={paused} viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="7" className="island-ring-track" />
      <circle cx="9" cy="9" r="7" className="island-ring-fill" strokeDasharray={length} strokeDashoffset={progress === null ? length * 0.75 : length * (1 - progress)} />
    </svg>
  );
}

function Button({ label, icon, primary, onClick }: { label: string; icon?: ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="island-button" data-primary={primary} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

/** The left and right of the notch: what shows before hovering. */
function wingsFor(glance: Exclude<Glance, { kind: 'idle' }>): [ReactNode, ReactNode] {
  if (glance.kind === 'focus') return [<Ring key="l" progress={glance.progress} paused={glance.paused} />, <span key="r" className="island-clock" data-paused={glance.paused}>{glance.clock}</span>];
  if (glance.kind === 'check-in') return [<span key="l" className="island-badge" data-tone="accent"><Check {...ICON} /></span>, <span key="r" className="island-clock">Done?</span>];
  return [<span key="l" className="island-badge" data-tone="meeting"><CalendarClock {...ICON} /></span>, <span key="r" className="island-clock">{glance.clock}</span>];
}

function Panel({ glance, askMore, setAskMore }: { glance: Exclude<Glance, { kind: 'idle' }>; askMore: boolean; setAskMore: (on: boolean) => void }) {
  if (glance.kind === 'focus') {
    return (
      <>
        <div className="island-title">{glance.title}</div>
        <div className="island-sub">{glance.paused ? 'Paused' : glance.progress === null ? 'Stopwatch' : 'Focus'}</div>
        <div className="island-actions">
          {glance.paused ? <Button label="Resume" icon={<Play {...ICON} />} primary onClick={() => act({ kind: 'resume' })} /> : <Button label="Pause" icon={<Pause {...ICON} />} onClick={() => act({ kind: 'pause' })} />}
          {glance.progress !== null && <Button label="5 min" icon={<Plus {...ICON} />} onClick={() => act({ kind: 'add' })} />}
          {glance.hasTodo && <Button label="Done" icon={<Check {...ICON} />} onClick={() => act({ kind: 'done' })} />}
          <Button label="Stop" icon={<Square size={11} strokeWidth={2.5} />} onClick={() => act({ kind: 'stop' })} />
        </div>
      </>
    );
  }
  if (glance.kind === 'check-in') {
    return (
      <>
        <div className="island-title">{glance.title}</div>
        <div className="island-sub">{askMore ? 'How much more does it need?' : glance.hasTodo ? "Time's up. Is it done?" : "Time's up."}</div>
        <CheckInActions hasTodo={glance.hasTodo} askMore={askMore} setAskMore={setAskMore} />
      </>
    );
  }
  return (
    <>
      <div className="island-title">{glance.title}</div>
      <div className="island-sub">
        {glance.clock === 'Now' ? 'Started' : `Starts in ${glance.clock}`}
        {glance.focus && ` · Focus ${glance.focus.paused ? 'paused' : glance.focus.clock}`}
      </div>
      <div className="island-actions">
        {glance.joinUrl && <Button label="Join" icon={<Video {...ICON} />} primary onClick={() => window.vision.focus.join()} />}
        <Button label="Hide" icon={<X {...ICON} />} onClick={() => window.vision.focus.dismissMeeting()} />
      </div>
      {glance.checkIn && (
        // A countdown that ended just before the meeting still waits for its answer.
        <div className="island-check-in">
          <div className="island-sub">{askMore ? 'How much more does it need?' : `Time's up: ${glance.checkIn.title}`}</div>
          <CheckInActions hasTodo={glance.checkIn.hasTodo} askMore={askMore} setAskMore={setAskMore} />
        </div>
      )}
    </>
  );
}

/** Done, +5 min, Not yet (then how much more), and Stop, which closes the check-in without changing the to-do. */
function CheckInActions({ hasTodo, askMore, setAskMore }: { hasTodo: boolean; askMore: boolean; setAskMore: (on: boolean) => void }) {
  return (
    <div className="island-actions">
      {askMore ? (
        <>
          {MORE_TIME_CHOICES.map((minutes) => <Button key={minutes} label={moreLabel(minutes)} onClick={() => act({ kind: 'not-yet', minutes })} />)}
          <Button label="Back" onClick={() => setAskMore(false)} />
        </>
      ) : (
        <>
          <Button label={hasTodo ? 'Done' : 'Finish'} icon={<Check {...ICON} />} primary onClick={() => act({ kind: 'done' })} />
          <Button label="5 min" icon={<Plus {...ICON} />} onClick={() => act({ kind: 'add' })} />
          {hasTodo && <Button label="Not yet" onClick={() => setAskMore(true)} />}
          <Button label="Stop" icon={<Square size={11} strokeWidth={2.5} />} onClick={() => act({ kind: 'stop' })} />
        </>
      )}
    </div>
  );
}

/**
 * The island: the MacBook's notch growing down a little (top center on other screens), after Black Hole and the iPhone's
 * Dynamic Island. It hangs below the notch instead of beside it: wings beside the notch covered the menu bar's own items
 * (2026-11-23). Shows a running focus or a meeting heads-up; hovering opens the controls in a card below it. A check-in and a
 * meeting that has started open on their own, so the answer or Join is one click away.
 */
export function Island() {
  const [update, setUpdate] = useState<IslandUpdate | null>(null);
  const [hover, setHover] = useState(false);
  const [askMore, setAskMore] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => window.vision.focus.onIsland(setUpdate), []);

  const glance = update?.view.glance ?? { kind: 'idle' };
  const kind = glance.kind;
  // Whatever shows next starts closed (React's "adjust state when a prop changes" pattern, no effect needed).
  const [shownKind, setShownKind] = useState(kind);
  if (kind !== shownKind) {
    setShownKind(kind);
    setAskMore(false);
    if (kind === 'idle') setHover(false);
  }
  // Nothing to show: the window lets every click through again.
  useEffect(() => {
    if (kind === 'idle') window.vision.focus.islandHover(false);
  }, [kind]);

  if (!update || glance.kind === 'idle') return null;
  const open = hover || glance.kind === 'check-in' || (glance.kind === 'meeting' && glance.clock === 'Now');
  const enter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHover(true);
    window.vision.focus.islandHover(true);
  };
  const leave = () => {
    // Clicks go back to the app underneath at once; only the look waits.
    window.vision.focus.islandHover(false);
    closeTimer.current = setTimeout(() => setHover(false), CLOSE_DELAY_MS);
  };
  const [left, right] = wingsFor(glance);

  return (
    <div
      className="island"
      data-notch={update.notch}
      data-open={open}
      data-kind={glance.kind}
      style={{ ['--island-bar' as string]: `${Math.max(update.menuBar, 28)}px` }}
      onPointerEnter={enter}
      onPointerLeave={leave}
      role="status"
      aria-label={glance.kind === 'focus' ? `Focus: ${glance.title}, ${glance.clock}` : glance.title}
    >
      <div className="island-bar">
        <span className="island-wing">{left}</span>
        {!update.notch && <span className="island-bar-title">{glance.title}</span>}
        <span className="island-wing island-wing-right">{right}</span>
      </div>
      <div className="island-panel" aria-hidden={!open} inert={!open}>
        <div className="island-card">
          <Panel glance={glance} askMore={askMore} setAskMore={setAskMore} />
        </div>
      </div>
    </div>
  );
}
