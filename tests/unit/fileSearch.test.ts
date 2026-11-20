import { describe, expect, it } from 'vitest';
import { matchesAll, rankHits, searchWords, type SearchHit } from '../../src/shared/fileSearch';

const hit = (relative: string, isDirectory = false): SearchHit => ({ path: `/root/${relative}`, relative, isDirectory });

describe('file search', () => {
  it('splits the words, ignoring case, accents and slashes', () => {
    expect(searchWords('  Nurve  CLAUDE ')).toEqual(['nurve', 'claude']);
    expect(searchWords('código/notes')).toEqual(['codigo', 'notes']);
    expect(searchWords('   ')).toBeNull();
    expect(searchWords(42)).toBeNull();
  });

  it('needs every word somewhere in the path, emojis and all', () => {
    expect(matchesAll('🛒 NURVE/store/CLAUDE.md', ['nurve', 'claude'])).toBe(true);
    expect(matchesAll('💻 CODING/Código.md', ['codigo'])).toBe(true);
    expect(matchesAll('🛒 NURVE/store/theme.liquid', ['nurve', 'claude'])).toBe(false);
  });

  it('puts exact and starting names first, then shallower paths', () => {
    const ranked = rankHits(
      [hit('a/b/old-skills-notes.md'), hit('⚙️ SKILLS', true), hit('x/skills.md'), hit('notes/skills-list.md'), hit('skills/deep/readme.md')],
      ['skills'],
    ).map((item) => item.relative);
    expect(ranked).toEqual(['⚙️ SKILLS', 'x/skills.md', 'notes/skills-list.md', 'a/b/old-skills-notes.md', 'skills/deep/readme.md']);
  });
});
