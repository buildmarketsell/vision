import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reduceClaudeEvent, reduceLocal } from '../../src/features/claude-terminal/renderer/chat/chatReducer';
import { emptyChatState, type ChatState } from '../../src/features/claude-terminal/renderer/chat/chatTypes';
import { describeTool } from '../../src/features/claude-terminal/renderer/chat/eventParsing';
import { messagesFromTranscript, titleFromTail } from '../../src/features/claude-terminal/main/transcripts';
import { toClaudeMessage } from '../../src/features/claude-terminal/main/chatProcess';

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
