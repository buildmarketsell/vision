import { useState } from 'react';
import { ShieldQuestion, MessageCircleQuestion } from 'lucide-react';
import type { PermissionRequest, QuestionRequest, ToolCall } from './chatTypes';
import { describeTool } from './eventParsing';
import { ToolDetail } from './ToolRow';

function permissionTitle(toolName: string): string {
  if (toolName === 'Bash') return 'Claude wants to run a command';
  if (['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(toolName)) return 'Claude wants to change a file';
  if (toolName === 'WebFetch' || toolName === 'WebSearch') return 'Claude wants to use the web';
  return `Claude wants to use ${toolName.startsWith('mcp__') ? toolName.split('__').slice(1).join(' · ') : toolName}`;
}

/** Allow / Deny card for a tool that needs your OK. */
export function PermissionCard({ request, onAllow, onDeny }: { request: PermissionRequest; onAllow: () => void; onDeny: () => void }) {
  const tool: ToolCall = { id: request.requestId, name: request.toolName, input: request.input, status: 'running', result: null };
  return (
    <div className="request-card enter" role="alertdialog" aria-label={permissionTitle(request.toolName)}>
      <div className="flex items-center gap-2">
        <ShieldQuestion size={16} strokeWidth={1.75} color="var(--color-accent)" />
        <span className="title">{permissionTitle(request.toolName)}</span>
      </div>
      <div className="caption">{request.description ?? describeTool(request.toolName, request.input)}</div>
      <ToolDetail tool={tool} showResult={false} />
      <div className="flex justify-end gap-2">
        <button className="button-secondary" onClick={onDeny}>Deny</button>
        <button className="button-primary" onClick={onAllow} autoFocus>Allow</button>
      </div>
    </div>
  );
}

/** Claude's question with its options; "Other" lets you type your own answer. */
export function QuestionCard({ request, onAnswer }: { request: QuestionRequest; onAnswer: (answers: Record<string, string>) => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const toggle = (question: string, label: string, multi: boolean) => {
    const current = picked[question] ?? [];
    const next = multi ? (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]) : [label];
    setPicked({ ...picked, [question]: next });
  };
  const answers = Object.fromEntries(
    request.questions.map((item) => [item.question, [...(picked[item.question] ?? []), other[item.question]?.trim() ?? ''].filter(Boolean).join(', ')]),
  );
  const complete = request.questions.every((item) => answers[item.question]);

  return (
    <div className="request-card enter" role="dialog" aria-label="Claude has a question">
      {request.questions.map((item) => (
        <div key={item.question} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion size={16} strokeWidth={1.75} color="var(--color-accent)" />
            {item.header && <span className="caption">{item.header}</span>}
          </div>
          <div className="title">{item.question}</div>
          <div className="flex flex-col gap-1">
            {item.options.map((option) => {
              const selected = (picked[item.question] ?? []).includes(option.label);
              return (
                <button key={option.label} className="option-button" data-selected={selected} onClick={() => toggle(item.question, option.label, item.multiSelect)}>
                  <span className="font-medium">{option.label}</span>
                  {option.description && <span className="caption">{option.description}</span>}
                </button>
              );
            })}
            <input
              className="field"
              placeholder="Other answer"
              aria-label={`Other answer to: ${item.question}`}
              value={other[item.question] ?? ''}
              onChange={(event) => setOther({ ...other, [item.question]: event.target.value })}
            />
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button className="button-primary" disabled={!complete} onClick={() => onAnswer(answers)}>Send Answer</button>
      </div>
    </div>
  );
}
