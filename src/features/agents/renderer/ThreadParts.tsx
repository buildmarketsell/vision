import { useState } from 'react';
import { Check, CircleSlash, X } from 'lucide-react';
import type { Agent } from '../../../shared/agents';
import type { ChatItem, ChatState, PermissionRequest, QuestionRequest, ToolCall } from '../../../shared/chat/chatTypes';
import { asStr, describeTool } from '../../../shared/chat/eventParsing';
import { Markdown } from '../../../renderer/components/Markdown';
import { useNow } from '../../../renderer/core/useNow';
import { AgentFace } from './AgentFace';
import { sendToAgent } from './agentsStore';

/** Bupsy's thread: your messages as grey bubbles on the right, the agent's replies under its face and name. */

function ToolLine({ tool }: { tool: ToolCall }) {
  const Icon = tool.status === 'error' ? X : tool.status === 'denied' ? CircleSlash : Check;
  return (
    <div className="agent-tool" data-status={tool.status} title={tool.blockedReason ?? undefined}>
      {tool.status === 'running' ? <span className="agent-tool-dot" aria-hidden /> : <Icon size={12} strokeWidth={2} aria-hidden />}
      <span className="truncate">{describeTool(tool.name, tool.input)}</span>
      {tool.blockedReason && <span className="agent-tool-blocked">Blocked: {tool.blockedReason}</span>}
    </div>
  );
}

function Item({ item, state, folder }: { item: ChatItem; state: ChatState; folder: string }) {
  if (item.kind === 'user') return <div className="agent-bubble">{item.text}</div>;
  if (item.kind === 'text') return <div className="agent-text"><Markdown text={item.text} baseDir={folder} /></div>;
  if (item.kind === 'notice') return <div className="agent-notice" data-tone={item.tone}>{item.text}</div>;
  const tool = state.tools[item.toolId];
  return tool && tool.name !== 'AskUserQuestion' ? <ToolLine tool={tool} /> : null;
}

/** The messages, with the agent's face and name heading each of its replies. */
export function ThreadItems({ agent, state }: { agent: Agent; state: ChatState }) {
  const rows: React.ReactNode[] = [];
  let replyOpen = false;
  for (const item of state.items) {
    const fromAgent = item.kind === 'text' || item.kind === 'tool';
    if (fromAgent && !replyOpen) {
      rows.push(
        <div key={`head-${item.key}`} className="agent-reply-head">
          <AgentFace face={agent.face} size={28} />
          <span className="agent-reply-name">{agent.name}</span>
        </div>,
      );
    }
    replyOpen = fromAgent || (replyOpen && item.kind === 'notice');
    rows.push(<div key={item.key} className={fromAgent ? 'agent-reply-body' : undefined}><Item item={item} state={state} folder={agent.folder} /></div>);
  }
  return <>{rows}</>;
}

function approvalTitle(toolName: string): string {
  if (toolName === 'Bash') return 'wants to run a command';
  if (['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(toolName)) return 'wants to change a file';
  if (toolName === 'WebFetch' || toolName === 'WebSearch') return 'wants to use the web';
  return `wants to use ${toolName.startsWith('mcp__') ? toolName.split('__').slice(1).join(' · ') : toolName}`;
}

/** Bupsy's approval card: what the agent wants to do, the exact command or file, and a pink lip with Allow and Deny. */
export function ApprovalCard({ agent, request }: { agent: Agent; request: PermissionRequest }) {
  const command = asStr(request.input['command']) ?? asStr(request.input['file_path']) ?? asStr(request.input['url']);
  return (
    <div className="agent-card" data-tone="approval" role="alertdialog" aria-label={`${agent.name} ${approvalTitle(request.toolName)}`}>
      <div className="agent-card-body">
        <div className="agent-card-title">
          <AgentFace face={agent.face} mood="waiting" size={24} />
          <span><b>{agent.name}</b> {approvalTitle(request.toolName)}</span>
        </div>
        <div className="agent-card-detail">{request.description ?? describeTool(request.toolName, request.input)}</div>
        {command && <pre className="agent-card-code">{command}</pre>}
      </div>
      <div className="agent-card-lip">
        <button className="agent-button" data-kind="primary" onClick={() => sendToAgent(agent.id, { kind: 'allow', requestId: request.requestId, updatedInput: request.input })}>Allow</button>
        <button
          className="agent-button"
          data-kind="ghost-destructive"
          onClick={() => sendToAgent(agent.id, { kind: 'deny', requestId: request.requestId, message: 'The user declined this. Ask what they would like instead.' })}
        >
          Deny
        </button>
        <span className="agent-card-hint">{request.toolName === 'Bash' ? 'Commands follow its trust level' : 'Change its trust level in Details'}</span>
      </div>
    </div>
  );
}

/** A question from the agent, with a grey lip; "Other" takes your own words. */
export function AgentQuestionCard({ agent, request }: { agent: Agent; request: QuestionRequest }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const answers = Object.fromEntries(request.questions.map((item) => [item.question, [...(picked[item.question] ?? []), other[item.question]?.trim() ?? ''].filter(Boolean).join(', ')]));
  const complete = request.questions.every((item) => answers[item.question]);
  return (
    <div className="agent-card" data-tone="question" role="dialog" aria-label={`${agent.name} has a question`}>
      <div className="agent-card-body">
        {request.questions.map((item) => (
          <div key={item.question} className="agent-question">
            <div className="agent-card-title">
              <AgentFace face={agent.face} mood="waiting" size={24} />
              <b>{item.question}</b>
            </div>
            <div className="agent-options">
              {item.options.map((option) => {
                const selected = (picked[item.question] ?? []).includes(option.label);
                const current = picked[item.question] ?? [];
                const next = item.multiSelect ? (selected ? current.filter((label) => label !== option.label) : [...current, option.label]) : [option.label];
                return (
                  <button key={option.label} className="agent-option" data-selected={selected} onClick={() => setPicked({ ...picked, [item.question]: next })}>
                    <span>{option.label}</span>
                    {option.description && <span className="agent-muted">{option.description}</span>}
                  </button>
                );
              })}
              <input className="agent-field" placeholder="Other answer" aria-label={`Other answer to: ${item.question}`} value={other[item.question] ?? ''} onChange={(event) => setOther({ ...other, [item.question]: event.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <div className="agent-card-lip">
        <button className="agent-button" data-kind="primary" disabled={!complete} onClick={() => sendToAgent(agent.id, { kind: 'allow', requestId: request.requestId, updatedInput: { ...request.input, answers } })}>
          Send answer
        </button>
      </div>
    </div>
  );
}

/** Bupsy's thinking line: the agent's working face, what it is doing now, and the seconds. */
export function ThinkingLine({ agent, state }: { agent: Agent; state: ChatState }) {
  const [startedAt] = useState(Date.now);
  const seconds = Math.floor((useNow(1000) - startedAt) / 1000);
  const running = Object.values(state.tools).findLast((tool) => tool.status === 'running');
  return (
    <div className="agent-thinking" role="status" aria-live="polite">
      <AgentFace face={agent.face} mood="working" size={22} />
      <span className="agent-thinking-step">{running ? describeTool(running.name, running.input) : 'Thinking'}…</span>
      <span className="agent-muted">{seconds}s</span>
    </div>
  );
}
