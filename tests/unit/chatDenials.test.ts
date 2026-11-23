import { describe, expect, it } from 'vitest';
import { blockedReason, reduceClaudeEvent } from '../../src/shared/chat/chatReducer';
import { emptyChatState } from '../../src/shared/chat/chatTypes';

const AUTO_MODE_MESSAGE =
  'Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Undermining Oversight]. If you have other tasks that do not depend on this action, continue working on those.';

function withBashCall() {
  return reduceClaudeEvent(emptyChatState(), {
    type: 'assistant',
    message: { id: 'm1', content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'python3 -m http.server', description: 'Serve the block locally' } }] },
  });
}

describe('tools Claude Code refused', () => {
  it('marks the tool row blocked with a short reason instead of adding a notice', () => {
    const state = reduceClaudeEvent(withBashCall(), {
      type: 'system',
      subtype: 'permission_denied',
      tool_use_id: 'tool-1',
      decision_reason_type: 'classifier',
      message: AUTO_MODE_MESSAGE,
    });
    expect(state.items.filter((item) => item.kind === 'notice')).toHaveLength(0);
    expect(state.tools['tool-1']).toMatchObject({ status: 'denied', blockedReason: 'Blocked by auto mode: Undermining Oversight' });

    const afterResult = reduceClaudeEvent(state, {
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1', is_error: true, content: AUTO_MODE_MESSAGE }] },
    });
    expect(afterResult.tools['tool-1']).toMatchObject({ status: 'denied', result: AUTO_MODE_MESSAGE });
  });

  it('keeps reasons short, and falls back to a plain notice for an unknown tool', () => {
    expect(blockedReason({ decision_reason_type: 'hook', decision_reason: 'x'.repeat(200) })).toHaveLength('Blocked by Claude Code: '.length + 80);
    expect(blockedReason({})).toBe('Blocked by Claude Code');
    const state = reduceClaudeEvent(emptyChatState(), { type: 'system', subtype: 'permission_denied', tool_use_id: 'nope', message: AUTO_MODE_MESSAGE });
    expect(state.items).toMatchObject([{ kind: 'notice', text: 'Claude Code blocked an action.' }]);
  });
});
