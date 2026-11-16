import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reduceClaudeEvent, reduceLocal } from '../../src/features/claude-terminal/renderer/chat/chatReducer';
import { emptyChatState, type ChatState } from '../../src/features/claude-terminal/renderer/chat/chatTypes';
import { describeTool } from '../../src/features/claude-terminal/renderer/chat/eventParsing';
import { messagesFromTranscript, titleFromTail } from '../../src/features/claude-terminal/main/transcripts';
import { toClaudeMessage } from '../../src/features/claude-terminal/main/chatProcess';
import { mentionFor } from '../../src/features/claude-terminal/renderer/chat/useDraft';
import { matchCommands, slashQuery } from '../../src/features/claude-terminal/renderer/chat/useSlashMenu';

/** Replays a recorded real session: lines Claude printed, and what the host sent (`__sent__`). */
function replay(name: string, stopAtFirst?: (state: ChatState) => boolean): ChatState {
  const lines = readFileSync(join(import.meta.dirname, '../fixtures/claude', name), 'utf8').split('\n').filter(Boolean);
  let state = emptyChatState();
  for (const line of lines) {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const sent = parsed['__sent__'] as Record<string, unknown> | undefined;
    if (sent?.['type'] === 'user') {
      const message = sent['message'] as { content: string };
      state = reduceLocal(state, { type: 'local/sent', text: message.content });
    } else if (sent?.['type'] === 'control_response') {
      const response = sent['response'] as { request_id: string };
      state = reduceLocal(state, { type: 'local/resolved', requestId: response.request_id, denied: false });
    } else if (!sent) {
      state = reduceClaudeEvent(state, parsed);
    }
    if (stopAtFirst?.(state)) return state;
  }
  return state;
}

describe('chat reducer on a real recorded session', () => {
  it('shows a permission request for the command Claude wants to run', () => {
    const state = replay('permission-allow.jsonl', (current) => current.permissions.length > 0);
    expect(state.permissions[0]?.toolName).toBe('Bash');
    expect(state.permissions[0]?.input['command']).toContain('notes.txt');
    expect(state.phase).toBe('working');
  });

  it('ends a turn with the tool done, the reply shown and the session id known', () => {
    const state = replay('permission-allow.jsonl');
    const tools = Object.values(state.tools);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe('done');
    expect(state.items.some((item) => item.kind === 'text' && item.text.length > 0 && !item.streaming)).toBe(true);
    expect(state.items.filter((item) => item.kind === 'user')).toHaveLength(1);
    expect(state.phase).toBe('idle');
    expect(state.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.costUsd).toBeGreaterThan(0);
    expect(state.unknownEvents).toBe(0);
  });

  it('turns AskUserQuestion into a question card with its options', () => {
    const state = replay('question-and-interrupt.jsonl', (current) => current.questions.length > 0);
    expect(state.questions[0]?.questions[0]?.options.map((option) => option.label)).toEqual(['Red', 'Blue']);
  });

  it('marks an interrupted turn as stopped', () => {
    const state = replay('question-and-interrupt.jsonl');
    expect(state.items.some((item) => item.kind === 'notice' && item.text === 'Stopped.')).toBe(true);
    expect(state.phase).toBe('idle');
    expect(state.questions).toHaveLength(0);
  });

  it('never throws on junk', () => {
    let state = emptyChatState();
    for (const junk of [null, 42, 'text', {}, { type: 'mystery' }, { type: 'assistant', message: 7 }, { type: 'user', message: { content: [1, null] } }]) {
      state = reduceClaudeEvent(state, junk);
    }
    expect(state.unknownEvents).toBe(5);
  });
});

describe('describeTool', () => {
  it('summarises common tools in plain words', () => {
    expect(describeTool('Read', { file_path: '/a/b/app.ts' })).toBe('Read app.ts');
    expect(describeTool('Bash', { command: 'ls', description: 'List files' })).toBe('Ran List files');
    expect(describeTool('mcp__notion__search', {})).toBe('Used notion · search');
  });
});

describe('transcripts', () => {
  it('prefers Claude’s own title over the last prompt', () => {
    const tail = '{"type":"last-prompt","lastPrompt":"do x"}\n{"type":"ai-title","aiTitle":"Fix the login bug"}\n';
    expect(titleFromTail(tail)).toBe('Fix the login bug');
    expect(titleFromTail('{"type":"last-prompt","lastPrompt":"do x"}')).toBe('do x');
  });
  it('keeps only main-thread user and assistant messages', () => {
    const text = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }),
      JSON.stringify({ type: 'user', isMeta: true, message: { role: 'user', content: 'meta' } }),
      JSON.stringify({ type: 'assistant', isSidechain: true, message: { content: [] } }),
      JSON.stringify({ type: 'api-request-blob', message: { role: 'system' } }),
    ].join('\n');
    expect(messagesFromTranscript(text)).toHaveLength(1);
  });
});

describe('toClaudeMessage (validation in main)', () => {
  it('builds the stream-json lines Claude expects', () => {
    expect(toClaudeMessage({ kind: 'message', text: 'hello' })).toEqual({ type: 'user', message: { role: 'user', content: 'hello' } });
    expect(toClaudeMessage({ kind: 'allow', requestId: 'r1', updatedInput: { a: 1 } })).toMatchObject({
      type: 'control_response',
      response: { request_id: 'r1', response: { behavior: 'allow', updatedInput: { a: 1 } } },
    });
  });
  it('rejects anything malformed', () => {
    expect(toClaudeMessage({ kind: 'message', text: '   ' })).toBeNull();
    expect(toClaudeMessage({ kind: 'allow', requestId: 'r1', updatedInput: 'nope' })).toBeNull();
    expect(toClaudeMessage({ kind: 'setPermissionMode', mode: 'bypassPermissions' })).toBeNull();
    expect(toClaudeMessage('drop table')).toBeNull();
  });
});

describe('images and dropped paths', () => {
  const png = { mediaType: 'image/png', data: 'iVBORw0KGgo=' };
  it('sends images before the text, and allows an image with no text', () => {
    expect(toClaudeMessage({ kind: 'message', text: 'what is this', images: [png] })).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.data } },
          { type: 'text', text: 'what is this' },
        ],
      },
    });
    expect(toClaudeMessage({ kind: 'message', text: '', images: [png] })).toMatchObject({ message: { content: [{ type: 'image' }] } });
  });
  it('rejects bad images', () => {
    expect(toClaudeMessage({ kind: 'message', text: 'x', images: [{ mediaType: 'image/svg+xml', data: png.data }] })).toBeNull();
    expect(toClaudeMessage({ kind: 'message', text: 'x', images: [{ mediaType: 'image/png', data: 'not base64!' }] })).toBeNull();
    expect(toClaudeMessage({ kind: 'message', text: 'x', images: Array.from({ length: 11 }, () => png) })).toBeNull();
  });
  it('mentions paths relative inside the folder, full outside it', () => {
    expect(mentionFor('/work/site', '/work/site/src/a.ts')).toBe('@src/a.ts ');
    expect(mentionFor('/work/site', '/Users/dan/Desktop/shot.pdf')).toBe('@/Users/dan/Desktop/shot.pdf ');
    expect(mentionFor('/work/site', '/work/site-old/a.ts')).toBe('@/work/site-old/a.ts ');
  });
});

describe('session info: models, slash commands, context', () => {
  it('reads models and commands from the reply to initialize', () => {
    const state = reduceClaudeEvent(emptyChatState(), {
      type: 'control_response',
      response: { subtype: 'success', request_id: 'i1', response: { models: [{ value: 'haiku', displayName: 'Haiku', description: 'Fast' }, { nope: 1 }], commands: [{ name: 'review', description: 'Review' }] } },
    });
    expect(state.info.models).toEqual([{ value: 'haiku', displayName: 'Haiku', description: 'Fast' }]);
    expect(state.info.commands).toEqual([{ name: 'review', description: 'Review', argumentHint: '' }]);
  });
  it('tracks context use and the window from a real session', () => {
    const state = replay('permission-allow.jsonl');
    expect(state.info.contextUsed).toBeGreaterThan(20_000);
    expect(state.info.contextWindow).toBe(1_000_000);
  });
  it('ignores subagent usage and keeps the same object when nothing changed', () => {
    const before = emptyChatState();
    const after = reduceClaudeEvent(before, { type: 'assistant', parent_tool_use_id: 't1', message: { usage: { input_tokens: 99 } } });
    expect(after.info).toBe(before.info);
  });
  it('filters slash commands, prefix matches first', () => {
    const commands = ['review', 'pr-review', 'compact'].map((name) => ({ name, description: '', argumentHint: '' }));
    expect(slashQuery('/rev')).toBe('rev');
    expect(slashQuery('/review now')).toBeNull();
    expect(slashQuery('hi /rev')).toBeNull();
    expect(matchCommands(commands, 'rev').map((command) => command.name)).toEqual(['review', 'pr-review']);
  });
  it('validates model switches', () => {
    expect(toClaudeMessage({ kind: 'setModel', model: 'opus[1m]' })).toMatchObject({ request: { subtype: 'set_model', model: 'opus[1m]' } });
    expect(toClaudeMessage({ kind: 'setModel', model: 'haiku; rm -rf /' })).toBeNull();
  });
});
