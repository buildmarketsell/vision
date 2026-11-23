import { describe, expect, it } from 'vitest';
import { buildActions, filterActions } from '../../src/features/claude-terminal/renderer/chat/actions';
import { emptySessionInfo } from '../../src/shared/chat/sessionInfo';

const info = {
  ...emptySessionInfo(),
  models: [
    { value: 'opus', displayName: 'Opus 5.5', description: 'Complex work', supportsEffort: true },
    { value: 'haiku', displayName: 'Haiku', description: 'Fastest', supportsEffort: false },
  ],
  commands: [{ name: 'review', description: 'Review the current changes', argumentHint: '' }],
};

describe('actions menu', () => {
  it('lists Context, Model, Permissions and Slash commands in order, checking what is in use', () => {
    const items = buildActions(info, 'haiku', 'plan');
    expect([...new Set(items.map((item) => item.section))]).toEqual(['Context', 'Model', 'Permissions', 'Slash commands']);
    expect(items.filter((item) => item.checked).map((item) => item.label)).toEqual(['Haiku', 'Plan first']);
  });

  it('filters on every word, in label, detail or section', () => {
    const items = buildActions(info, 'opus', 'auto');
    expect(filterActions(items, 'plan').map((item) => item.label)).toEqual(['Plan first']);
    expect(filterActions(items, 'model fast').map((item) => item.label)).toEqual(['Haiku']);
    expect(filterActions(items, 'changes').map((item) => item.label)).toEqual(['/review']);
    expect(filterActions(items, '  ')).toHaveLength(items.length);
  });
});
