import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../..');
const fakeClaude = join(projectRoot, 'tests/e2e/fixtures/fake-claude.sh');

/** A throwaway folder with a few files, and settings that open it on launch. */
function makeFixture(): { folder: string; userData: string } {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'vision-folder-')));
  writeFileSync(join(folder, 'hello.md'), '# Hello\n');
  mkdirSync(join(folder, 'notes'));
  writeFileSync(join(folder, 'notes', 'idea.txt'), 'An idea\n');
  const userData = mkdtempSync(join(tmpdir(), 'vision-userdata-'));
  writeFileSync(join(userData, 'state.json'), JSON.stringify({ windows: [{ folder, bounds: null }], recentFolders: [folder] }));
  return { folder, userData };
}

/** process.env without ELECTRON_RUN_AS_NODE (set when tests run inside VS Code), which would start Electron as plain Node. */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value;
  }
  return env;
}

async function launch(userData: string): Promise<{ app: ElectronApplication; page: Page }> {
  // Set VISION_E2E_APP to the built VISION.app binary to test the packaged app instead of the dev build.
  const packaged = process.env['VISION_E2E_APP'];
  const app = await electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [projectRoot] }),
    env: { ...cleanEnv(), VISION_USER_DATA: userData, VISION_CLAUDE_COMMAND: fakeClaude },
  });
  const page = await app.firstWindow();
  return { app, page };
}

test('opens a folder, edits and saves a file, and starts Claude', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    // Claude pane runs the CLI in the open folder.
    await expect(page.locator('.xterm-rows')).toContainText('Fake Claude ready', { timeout: 15_000 });

    // File tree shows the folder's files; clicking one opens it in the editor.
    await page.getByRole('treeitem', { name: /hello\.md/ }).click();
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(editor).toContainText('# Hello');

    // Type, see the unsaved dot, save with Cmd+S, the file on disk changes.
    await editor.click();
    await page.keyboard.press('Meta+End');
    await page.keyboard.type('Saved from VISION');
    await expect(page.getByLabel('Unsaved changes')).toBeVisible();
    await page.keyboard.press('Meta+s');
    await expect.poll(() => readFileSync(join(folder, 'hello.md'), 'utf8')).toContain('Saved from VISION');
    await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);

    // A file created outside the app shows up in the tree.
    writeFileSync(join(folder, 'from-outside.md'), 'x');
    await expect(page.getByRole('treeitem', { name: /from-outside\.md/ })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'test-results/workspace.png' });
  } finally {
    await app.close();
  }
});

test('shows the Welcome screen when no folder is open', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'vision-userdata-'));
  const { app, page } = await launch(userData);
  try {
    await expect(page.getByRole('button', { name: 'Open Folder' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/welcome.png' });
  } finally {
    await app.close();
  }
});

test('closing a window with Claude running raises no errors in the main process', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await expect(page.locator('.xterm-rows')).toContainText('Fake Claude ready', { timeout: 15_000 });
    await app.evaluate(({ BrowserWindow }) => {
      const store = globalThis as unknown as { visionErrors: string[] };
      store.visionErrors = [];
      process.on('uncaughtException', (error) => store.visionErrors.push(String(error)));
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
    const errors = await app.evaluate(() => (globalThis as unknown as { visionErrors: string[] }).visionErrors);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
