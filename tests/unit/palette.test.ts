import { describe, expect, it } from 'vitest';
import { matchScore, rankItems, shortcutLabel } from '../../src/shared/palette';

describe('⌘K matching', () => {
  it('needs every word somewhere in the title or detail, accents ignored', () => {
    expect(matchScore({ title: 'Nuevo código' }, 'codigo')).not.toBeNull();
    expect(matchScore({ title: 'CLAUDE.md', detail: '🛒 NURVE/store' }, 'nurve claude')).not.toBeNull();
    expect(matchScore({ title: 'Calendar' }, 'todo')).toBeNull();
    expect(matchScore({ title: 'Calendar' }, '   ')).toBeNull();
  });

  it('ranks exact, then prefix, then word starts, then anywhere in the title, then detail only', () => {
    const items = [
      { title: 'notes', detail: 'calendar' },
      { title: 'Uncalendared' },
      { title: 'Open Calendar week' },
      { title: 'Calendar settings' },
      { title: 'Calendar' },
    ];
    expect(rankItems(items, 'calendar').map((item) => item.title)).toEqual(['Calendar', 'Calendar settings', 'Open Calendar week', 'Uncalendared', 'notes']);
  });

  it('keeps the original order for equal scores and respects the limit', () => {
    const items = [{ title: 'New File' }, { title: 'New Folder' }, { title: 'New Claude Session' }];
    expect(rankItems(items, 'new', 2).map((item) => item.title)).toEqual(['New File', 'New Folder']);
  });

  it('shows shortcuts the way macOS menus do', () => {
    expect(shortcutLabel('Mod+T')).toBe('⌘T');
    expect(shortcutLabel('Mod+Shift+.')).toBe('⌘⇧.');
    expect(shortcutLabel('Mod+\\')).toBe('⌘\\');
  });
});
