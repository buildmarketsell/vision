import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { Agent } from '../../../shared/agents';
import { AgentFace } from './AgentFace';
import { moodOf, sendToAgent, useAgentChat, useAgents } from './agentsStore';
import { AgentQuestionCard, ApprovalCard, ThinkingLine, ThreadItems } from './ThreadParts';

const STICK_PX = 80;
const MAX_COMPOSER_PX = 200;

/** Bupsy's composer: one rounded box, "Message <name>", a pink round send button (a stop square while it works). */
function Composer({ agent, working, handingOff }: { agent: Agent; working: boolean; handingOff: boolean }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_COMPOSER_PX)}px`;
  }, [text]);
  useEffect(() => ref.current?.focus(), [agent.id]);
  const send = () => {
    if (!text.trim() || handingOff) return;
    sendToAgent(agent.id, { kind: 'message', text: text.trim() });
    setText('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };
  return (
    <div className="agent-composer" data-working={working}>
      <textarea ref={ref} rows={1} value={text} disabled={handingOff} placeholder={handingOff ? `${agent.name} is writing its handoff note…` : `Message ${agent.name}`} aria-label={`Message ${agent.name}`} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} />
      {working && !text.trim() ? (
        <button className="agent-send" data-stop="true" aria-label="Stop" title="Stop" onClick={() => sendToAgent(agent.id, { kind: 'interrupt' })}>
          <Square size={12} fill="currentColor" strokeWidth={0} />
        </button>
      ) : (
        <button className="agent-send" aria-label="Send" title="Send" disabled={!text.trim()} onClick={send}>
          <ArrowUp size={18} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}

function EmptyThread({ agent }: { agent: Agent }) {
  return (
    <div className="agent-empty">
      <AgentFace face={agent.face} size={72} />
      <div className="agent-empty-title">{agent.name} is ready</div>
      <div className="agent-muted">{agent.job || 'Give it a job in Details, or just say what you need.'}</div>
    </div>
  );
}

/** One agent's chat: breadcrumb and Details on top, the thread, then approvals, the thinking line and the composer. */
export function AgentThread({ agent }: { agent: Agent }) {
  const state = useAgentChat(agent.id);
  const status = useAgents((store) => store.statuses[agent.id]);
  const setDetailsOpen = useAgents((store) => store.setDetailsOpen);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const working = state?.phase === 'working';
  const waiting = (state?.permissions.length ?? 0) + (state?.questions.length ?? 0) > 0;

  useEffect(() => {
    const element = scroller.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [state]);
  // Seeing the chat reads its replies.
  useEffect(() => {
    if (status?.repliedAt && (agent.lastReadAt === null || status.repliedAt > agent.lastReadAt)) window.vision.agents.markRead(agent.id);
  }, [agent.id, agent.lastReadAt, status?.repliedAt]);

  return (
    <div className="agent-thread">
      <header className="agent-thread-head">
        <nav className="agent-crumbs" aria-label="Breadcrumb">
          <span>Agents</span>
          <span>{agent.name}</span>
          <span aria-current="page">Chat</span>
        </nav>
        {status?.phase === 'working' && !waiting && <span className="agent-badge" data-tone="working">Working</span>}
        {waiting && <span className="agent-badge" data-tone="needs-you">Needs you</span>}
        <button className="agent-button" data-kind="secondary" onClick={() => setDetailsOpen(true)}>
          <AgentFace face={agent.face} mood={moodOf(agent, status)} size={18} />
          Details
        </button>
      </header>
      <div
        ref={scroller}
        className="agent-scroll"
        onScroll={() => {
          const element = scroller.current;
          if (element) atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_PX;
        }}
      >
        <div className="agent-column">
          {state === null ? <div className="spinner mx-auto mt-6" aria-label="Loading chat" /> : state.items.length === 0 ? <EmptyThread agent={agent} /> : <ThreadItems agent={agent} state={state} />}
        </div>
      </div>
      <div className="agent-dock agent-column">
        {state?.permissions.map((request) => <ApprovalCard key={request.requestId} agent={agent} request={request} />)}
        {state?.questions.map((request) => <AgentQuestionCard key={request.requestId} agent={agent} request={request} />)}
        {state && working && !waiting && <ThinkingLine agent={agent} state={state} />}
        <Composer agent={agent} working={working} handingOff={status?.handingOff ?? false} />
      </div>
    </div>
  );
}
