import { useState } from 'react';
import { Check, ChevronRight, CircleSlash, X } from 'lucide-react';
import { openFile } from '../../../../renderer/core/dockActions';
import { useWorkspace } from '../../../../renderer/core/workspaceStore';
import type { ToolCall } from './chatTypes';
import { asArr, asObj, asStr, describeTool, toolFilePath } from './eventParsing';

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
      {showResult && tool.result && !isEdit && <pre className={tool.status === 'done' ? 'code-block muted' : 'code-block muted wrap'}>{lines(tool.result).join('\n')}</pre>}
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

/** "Edited page.html" with the file name as a link that opens the file, when it is inside the open folder. */
function ToolLabel({ tool }: { tool: ToolCall }) {
  const folder = useWorkspace((state) => state.folder);
  const label = describeTool(tool.name, tool.input);
  const path = toolFilePath(tool.name, tool.input);
  const name = path?.slice(path.lastIndexOf('/') + 1);
  if (!path || !name || !folder || !path.startsWith(`${folder}/`) || !label.endsWith(name)) return <>{label}</>;
  return (
    <>
      {label.slice(0, -name.length)}
      <button type="button" className="file-link" title={`Open ${path.slice(folder.length + 1)}`} onClick={() => openFile(path)}>
        {name}
      </button>
    </>
  );
}

/** One line per tool call ("Read app.ts", "Ran npm test"); tap to see the details. A refused one says why underneath. */
export function ToolRow({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tool-row">
      {/* The whole line toggles for the mouse; the arrow button is the way in for the keyboard. */}
      <div className="row w-full cursor-pointer" onClick={(event) => {
          if (!(event.target as Element).closest('.file-link')) setOpen(!open);
        }}
      >
        <span className="flex w-4 justify-center">
          <StatusIcon status={tool.status} />
        </span>
        <span className="min-w-0 flex-1 truncate text-(--color-text-muted)">
          <ToolLabel tool={tool} />
        </span>
        <button type="button" className="tool-toggle" aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'}>
          <ChevronRight className="chevron" size={13} strokeWidth={1.75} color="var(--color-text-faint)" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
        </button>
      </div>
      {tool.blockedReason && <div className="tool-blocked caption">{tool.blockedReason}</div>}
      {open && (
        <div className="enter pt-1 pb-2 pl-8">
          <ToolDetail tool={tool} />
        </div>
      )}
    </div>
  );
}
