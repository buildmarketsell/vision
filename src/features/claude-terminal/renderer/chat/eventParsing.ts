import type { Question, Todo } from './chatTypes';

/** Small, defensive readers for Claude's stream-json events: wrong shapes give null, never throw. */

export type Obj = Record<string, unknown>;

export function asObj(value: unknown): Obj | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Obj) : null;
}

export function asStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Tool results come as a string or a list of text blocks. */
export function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  return asArr(content)
    .map((block) => asStr(asObj(block)?.['text']) ?? '')
    .filter(Boolean)
    .join('\n');
}

export function parseQuestions(input: Obj): Question[] {
  return asArr(input['questions']).flatMap((raw) => {
    const item = asObj(raw);
    const question = asStr(item?.['question']);
    if (!item || !question) return [];
    const options = asArr(item['options']).flatMap((option) => {
      const label = asStr(asObj(option)?.['label']);
      return label ? [{ label, description: asStr(asObj(option)?.['description']) ?? '' }] : [];
    });
    return [{ question, header: asStr(item['header']) ?? '', multiSelect: item['multiSelect'] === true, options }];
  });
}

const TODO_STATUSES = new Set(['pending', 'in_progress', 'completed']);

/** Claude's to-do list, from a TodoWrite tool call (if the CLI offers that tool). */
export function parseTodos(input: Obj): Todo[] | null {
  if (!Array.isArray(input['todos'])) return null;
  return asArr(input['todos']).flatMap((raw) => {
    const item = asObj(raw);
    const content = asStr(item?.['content']);
    const status = asStr(item?.['status']);
    if (!item || !content || !status || !TODO_STATUSES.has(status)) return [];
    return [{ content, status: status as Todo['status'], activeForm: asStr(item['activeForm']) }];
  });
}

/** A one-line description of a tool call, used in the chat and the live card. */
export function describeTool(name: string, input: Obj): string {
  const path = asStr(input['file_path']) ?? asStr(input['path']) ?? asStr(input['notebook_path']);
  const short = (value: string) => (value.length > 80 ? `${value.slice(0, 77)}…` : value);
  const file = path ? path.slice(path.lastIndexOf('/') + 1) : null;
  switch (name) {
    case 'Bash':
      return `Ran ${short(asStr(input['description']) ?? asStr(input['command']) ?? 'a command')}`;
    case 'Read':
      return `Read ${file ?? 'a file'}`;
    case 'Write':
      return `Wrote ${file ?? 'a file'}`;
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Edited ${file ?? 'a file'}`;
    case 'Grep':
      return `Searched for ${short(asStr(input['pattern']) ?? 'text')}`;
    case 'Glob':
      return `Found files matching ${short(asStr(input['pattern']) ?? '')}`;
    case 'WebSearch':
      return `Searched the web for ${short(asStr(input['query']) ?? '')}`;
    case 'WebFetch':
      return `Read ${short(asStr(input['url']) ?? 'a web page')}`;
    case 'Task':
      return `Started a helper: ${short(asStr(input['description']) ?? 'task')}`;
    case 'TodoWrite':
      return 'Updated the task list';
    case 'AskUserQuestion':
      return 'Asked you a question';
    default:
      return name.startsWith('mcp__') ? `Used ${name.split('__').slice(1).join(' · ')}` : `Used ${name}`;
  }
}
