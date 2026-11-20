import { describe, expect, it } from 'vitest';
import { boardFolders, breadcrumb, copyName, editedLabel, folderIn, folderView, nameOf, recentBoards } from '../../src/features/board/boardLibrary';

const ROOT = '/w';
const BOARDS = ['/w/Ideas.excalidraw', '/w/reels/Hooks.excalidraw', '/w/reels/old/Draft.excalidraw', '/w/clients/kilo/Ads.excalidraw', '/w/b.excalidraw'];

describe('board library', () => {
  it('lists the folders that hold boards at any depth, never the root', () => {
    expect(boardFolders(ROOT, BOARDS)).toEqual(['/w/clients', '/w/clients/kilo', '/w/reels', '/w/reels/old']);
  });

  it('shows a folder\'s sub-folders with board counts, then its own boards A to Z', () => {
    expect(folderView(ROOT, BOARDS)).toEqual({
      folders: [
        { path: '/w/clients', name: 'clients', boardCount: 1 },
        { path: '/w/reels', name: 'reels', boardCount: 2 },
      ],
      boards: ['/w/b.excalidraw', '/w/Ideas.excalidraw'],
    });
    expect(folderView('/w/reels', BOARDS).boards).toEqual(['/w/reels/Hooks.excalidraw']);
  });

  it('shows a just-made empty folder in its parent only', () => {
    expect(folderView(ROOT, BOARDS, ['/w/new']).folders.map((folder) => folder.name)).toEqual(['clients', 'new', 'reels']);
    expect(folderView('/w/reels', BOARDS, ['/w/new']).folders.map((folder) => folder.name)).toEqual(['old']);
  });

  it('puts the board edited last first, unknown times last', () => {
    expect(recentBoards(['/w/a.excalidraw', '/w/b.excalidraw', '/w/c.excalidraw'], { '/w/a.excalidraw': 1, '/w/c.excalidraw': 5 })).toEqual([
      '/w/c.excalidraw',
      '/w/a.excalidraw',
      '/w/b.excalidraw',
    ]);
  });

  it('says when a board was edited the way Figma does', () => {
    const now = Date.UTC(2026, 10, 20);
    expect(editedLabel(now - 20_000, now)).toBe('Edited just now');
    expect(editedLabel(now - 60_000, now)).toBe('Edited 1 minute ago');
    expect(editedLabel(now - 5 * 3_600_000, now)).toBe('Edited 5 hours ago');
    expect(editedLabel(now - 324 * 86_400_000, now)).toBe('Edited 10 months ago');
    expect(editedLabel(now + 5000, now)).toBe('Edited just now');
  });

  it('falls back to Recents for a place outside the open folder', () => {
    expect(folderIn(ROOT, '/w/reels')).toBe('/w/reels');
    expect(folderIn(ROOT, ROOT)).toBe(ROOT);
    expect(folderIn(ROOT, '/other/ideas')).toBeNull();
    expect(folderIn(ROOT, '/wx')).toBeNull();
    expect(folderIn(ROOT, 'recents')).toBeNull();
  });

  it('builds the breadcrumb from the root down', () => {
    expect(breadcrumb(ROOT, '/w/reels/old')).toEqual(['/w', '/w/reels', '/w/reels/old']);
    expect(breadcrumb(ROOT, ROOT)).toEqual(['/w']);
  });

  it('names copies without clashing and strips the extension from names', () => {
    expect(copyName('/w/Ideas.excalidraw', ['Ideas.excalidraw'])).toBe('Copy of Ideas.excalidraw');
    expect(copyName('/w/Ideas.excalidraw', ['copy of ideas.excalidraw'])).toBe('Copy of Ideas 2.excalidraw');
    expect(nameOf('/w/reels')).toBe('reels');
  });
});
