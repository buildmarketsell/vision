import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileMention } from '../../src/shared/fileMentions';
import { locateFile } from '../../src/main/workspace/findFiles';

describe('fileMention', () => {
  it('accepts file names and paths, with spaces and emoji, and drops line numbers', () => {
    expect(fileMention('2026-11-20_bf-cta-block.html')).toBe('2026-11-20_bf-cta-block.html');
    expect(fileMention('👤 CLIENTS/kilo/outputs/page.html')).toBe('👤 CLIENTS/kilo/outputs/page.html');
    expect(fileMention('src/app.ts:42')).toBe('src/app.ts');
    expect(fileMention('src/app.ts#L42-L51')).toBe('src/app.ts');
    expect(fileMention('~/Documents/notes.md')).toBe('~/Documents/notes.md');
  });

  it('rejects code, commands, links and numbers', () => {
    for (const text of ['npm run check', 'useState()', 'a = b.ts', 'https://x.com/a.html', '1.5', '--help.md', '*.ts', 'VISION', '']) {
      expect(fileMention(text), text).toBeNull();
    }
  });
});

describe('locateFile', () => {
  const folder = mkdtempSync(join(tmpdir(), 'vision-locate-'));
  mkdirSync(join(folder, '👤 CLIENTS', 'outputs'), { recursive: true });
  mkdirSync(join(folder, '.hidden'));
  writeFileSync(join(folder, '👤 CLIENTS', 'outputs', 'block.html'), '<p>hi</p>');
  writeFileSync(join(folder, '.hidden', 'secret.md'), 'x');
  const block = join(folder, '👤 CLIENTS', 'outputs', 'block.html');

  it('finds a file by path from the folder, absolute path, or bare name', async () => {
    expect(await locateFile(folder, '👤 CLIENTS/outputs/block.html')).toBe(block);
    expect(await locateFile(folder, block)).toBe(block);
    expect(await locateFile(folder, 'block.html')).toBe(block);
    expect(await locateFile(folder, 'outputs/block.html:3')).toBe(block);
  });

  it('never leaves the folder or looks in hidden folders', async () => {
    expect(await locateFile(folder, '/etc/hosts.txt')).toBeNull();
    expect(await locateFile(folder, '../outside.md')).toBeNull();
    expect(await locateFile(folder, 'secret.md')).toBeNull();
    expect(await locateFile(folder, 'missing.html')).toBeNull();
    expect(await locateFile(folder, 42)).toBeNull();
  });
});
