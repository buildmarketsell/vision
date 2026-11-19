import { describe, expect, it } from 'vitest';
import { isInsideFolder, looksBinary, parseShellPath, SHELL_PATH_MARKER, validateEntryName } from '../../src/main/paths';
import { clampZoom, normalizeAppState, pruneLayouts, withRecentFolder } from '../../src/main/appState';
import { shortcutFromEvent } from '../../src/renderer/core/commands';
import { relativeParts } from '../../src/renderer/core/workspaceStore';
import { cleanTitle } from '../../src/features/claude-terminal/renderer/sessionsStore';
import { rubberBand } from '../../src/renderer/components/Sidebar';

describe('isInsideFolder', () => {
  it('accepts the folder and paths inside it', () => {
    expect(isInsideFolder('/a/b', '/a/b')).toBe(true);
    expect(isInsideFolder('/a/b', '/a/b/c/d.md')).toBe(true);
  });
  it('rejects paths outside, sneaky .. paths, look-alike prefixes and relative paths', () => {
    expect(isInsideFolder('/a/b', '/a/c')).toBe(false);
    expect(isInsideFolder('/a/b', '/a/b/../c')).toBe(false);
    expect(isInsideFolder('/a/b', '/a/bc/file')).toBe(false);
    expect(isInsideFolder('/a/b', 'b/file')).toBe(false);
  });
});

describe('validateEntryName', () => {
  it('rejects empty, reserved and slash names', () => {
    expect(validateEntryName('  ')).not.toBeNull();
    expect(validateEntryName('..')).not.toBeNull();
    expect(validateEntryName('a/b')).not.toBeNull();
  });
  it('accepts normal names, including emoji and spaces', () => {
    expect(validateEntryName('🧠 CONTEXT')).toBeNull();
    expect(validateEntryName('notes.md')).toBeNull();
  });
});

describe('parseShellPath', () => {
  it('finds the PATH between markers even with noisy shell output', () => {
    const output = `Welcome!\n${SHELL_PATH_MARKER}/usr/bin:/opt/homebrew/bin${SHELL_PATH_MARKER}\nbye`;
    expect(parseShellPath(output)).toBe('/usr/bin:/opt/homebrew/bin');
  });
  it('returns null when the markers are missing', () => {
    expect(parseShellPath('nothing here')).toBeNull();
  });
});

describe('looksBinary', () => {
  it('spots NUL bytes', () => {
    expect(looksBinary(new Uint8Array([72, 0, 73]))).toBe(true);
    expect(looksBinary(new TextEncoder().encode('plain text'))).toBe(false);
  });
});

describe('app state', () => {
  it('falls back to defaults for broken data', () => {
    expect(normalizeAppState('garbage').recentFolders).toEqual([]);
    const state = normalizeAppState({ recentFolders: ['/a', 3], windows: [{ folder: '/a', bounds: { x: 'no' } }] });
    expect(state.recentFolders).toEqual(['/a']);
    expect(state.windows).toEqual([{ folder: '/a', bounds: null }]);
  });
  it('moves a reopened folder to the top without duplicates', () => {
    expect(withRecentFolder(['/a', '/b', '/c'], '/c')).toEqual(['/c', '/a', '/b']);
  });
  it('keeps layouts only for recent folders', () => {
    const state = normalizeAppState({
      recentFolders: ['/a'],
      layouts: { '/a': { dock: null, sidebarWidth: 300, showHidden: false }, '/old': { dock: null } },
    });
    expect(Object.keys(pruneLayouts(state))).toEqual(['/a']);
  });
  it('remembers a hidden sidebar and treats anything else as shown', () => {
    const state = normalizeAppState({
      recentFolders: ['/a', '/b'],
      layouts: { '/a': { dock: null, sidebarCollapsed: true }, '/b': { dock: null, sidebarCollapsed: 'yes' } },
    });
    expect(state.layouts['/a']?.sidebarCollapsed).toBe(true);
    expect(state.layouts['/b']?.sidebarCollapsed).toBe(false);
  });
  it('remembers a hidden menu, separately from the sidebar', () => {
    const state = normalizeAppState({
      recentFolders: ['/a', '/b'],
      layouts: { '/a': { dock: null, menuCollapsed: true }, '/b': { dock: null, menuCollapsed: 1 } },
    });
    expect(state.layouts['/a']?.menuCollapsed).toBe(true);
    expect(state.layouts['/a']?.sidebarCollapsed).toBe(false);
    expect(state.layouts['/b']?.menuCollapsed).toBe(false);
  });
});

describe('shortcutFromEvent', () => {
  const press = (code: string, key: string, extra: Partial<KeyboardEvent> = {}) =>
    shortcutFromEvent({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, code, key, ...extra });
  it('builds shortcut strings from key presses', () => {
    expect(press('KeyS', 's')).toBe('Mod+S');
    expect(press('Period', '>', { shiftKey: true })).toBe('Mod+Shift+.');
  });
});

describe('relativeParts', () => {
  it('splits a path inside the folder for breadcrumbs', () => {
    expect(relativeParts('/x/project', '/x/project/src/app.ts')).toEqual(['src', 'app.ts']);
  });
});

describe('cleanTitle', () => {
  it('drops the status symbol Claude Code puts before the conversation name', () => {
    expect(cleanTitle('✳ Workspace Electron app plan')).toBe('Workspace Electron app plan');
    expect(cleanTitle('⠂ Fix login bug')).toBe('Fix login bug');
  });
  it('keeps "Claude" until the conversation has a real name', () => {
    expect(cleanTitle('✳ Claude Code')).toBe('Claude');
    expect(cleanTitle('')).toBe('Claude');
  });
});

describe('rubberBand', () => {
  it('follows at first, then resists more the further it is pulled', () => {
    const small = rubberBand(10, 480);
    const large = rubberBand(400, 480);
    expect(small).toBeGreaterThan(5);
    expect(small).toBeLessThan(10);
    expect(large / 400).toBeLessThan(small / 10);
    expect(rubberBand(-10, 480)).toBeCloseTo(-small);
  });
});

describe('zoom level', () => {
  it('keeps the saved zoom within limits and falls back to 100%', () => {
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(99)).toBe(6);
    expect(clampZoom(-99)).toBe(-4);
    expect(clampZoom('big')).toBe(0);
    expect(normalizeAppState({}).zoomLevel).toBe(0);
  });
});
