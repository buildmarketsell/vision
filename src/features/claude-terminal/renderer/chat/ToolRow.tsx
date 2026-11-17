import { useState } from 'react';
import { Check, ChevronRight, CircleSlash, X } from 'lucide-react';
import type { ToolCall } from './chatTypes';
import { asArr, asObj, asStr, describeTool } from './eventParsing';

const MAX_PREVIEW_LINES = 60;

function lines(text: string): string[] {
  const all = text.replace(/\n$/, '').split('\n');
  return all.length > MAX_PREVIEW_LINES ? [...all.slice(0, MAX_PREVIEW_LINES), `… ${all.length - MAX_PREVIEW_LINES} more lines`] : all;
}

/** Before/after of an edit: removed lines in red, added lines in green. */
export function Diff({ removed, added }: { removed: string; added: string }) {
  return (
    <pre className="code-block">
      {removed !== '' && lines(removed).map((line, index) => <div key={`r${index}`} className="diff-removed">- {line}</div>)}
      {added !== '' && lines(added).map((line, index) => <div key={`a${index}`} className="diff-added">+ {line}</div>)}
    </pre>
  );
}

function editPairs(tool: ToolCall): Array<{ removed: string; added: string }> {
  const { input } = tool;
  if (tool.name === 'Write') return [{ removed: '', added: asStr(input['content']) ?? '' }];
  if (tool.name === 'MultiEdit') {
    return asArr(input['edits']).map((edit) => ({ removed: asStr(asObj(edit)?.['old_string']) ?? '', added: asStr(asObj(edit)?.['new_string']) ?? '' }));
  }
  return [{ removed: asStr(input['old_string']) ?? '', added: asStr(input['new_string']) ?? '' }];
}

/** The detail under a tool row: the command and its output, a diff, or the raw input. */
export function ToolDetail({ tool, showResult = true }: { tool: ToolCall; showResult?: boolean }) {
  const isEdit = ['Edit', 'MultiEdit', 'Write'].includes(tool.name);
  const command = tool.name === 'Bash' ? asStr(tool.input['command']) : null;
  return (
    <div className="flex flex-col gap-2">
      {command && <pre className="code-block">$ {command}</pre>}
      {isEdit && editPairs(tool).map((pair, index) => <Diff key={index} {...pair} />)}
      {!command && !isEdit && <pre className="code-block">{JSON.stringify(tool.input, null, 2)}</pre>}
      {showResult && tool.result && !isEdit && <pre className="code-block muted">{lines(tool.result).join('\n')}</pre>}
      {showResult && tool.result && isEdit && tool.status === 'error' && <pre className="code-block muted">{tool.result}</pre>}
    </div>
  );
}

function StatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running') return <div className="spinner" style={{ width: 12, height: 12 }} aria-label="Running" />;
  if (status === 'done') return <Check size={13} strokeWidth={2} color="var(--color-success)" aria-label="Done" />;
  if (status === 'denied' || status === 'stopped') return <CircleSlash size={13} strokeWidth={2} color="var(--color-text-faint)" aria-label={status} />;
  return <X size={13} strokeWidth={2} color="var(--color-danger)" aria-label="Failed" />;
}

/** One line per tool call ("Read app.ts", "Ran npm test"); tap to see the details. */
export function ToolRow({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tool-row">
      <button className="row w-full text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex w-4 justify-center">
          <StatusIcon status={tool.status} />
        </span>
        <span className="min-w-0 flex-1 truncate text-(--color-text-muted)">{describeTool(tool.name, tool.input)}</span>
        <ChevronRight className="chevron shrink-0" size={13} strokeWidth={1.75} color="var(--color-text-faint)" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
      </button>
      {open && (
        <div className="enter pt-1 pb-2 pl-8">
          <ToolDetail tool={tool} />
        </div>
      )}
    </div>
  );
}
