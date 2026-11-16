import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../..');
const fakeClaude = join(projectRoot, 'tests/e2e/fixtures/fake-claude.mjs');

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
    env: {
      ...cleanEnv(),
      VISION_USER_DATA: userData,
      VISION_CLAUDE_COMMAND: fakeClaude,
      VISION_CLAUDE_PROJECTS_DIR: mkdtempSync(join(tmpdir(), 'vision-transcripts-')),
      // Background mode: nothing shows on screen.
      VISION_HEADLESS: '1',
    },
  });
  const page = await app.firstWindow();
  return { app, page };
}

const messageBox = (page: Page) => page.getByRole('textbox', { name: 'Message Claude' });

async function sendMessage(page: Page, text: string): Promise<void> {
  await expect(messageBox(page).first()).toBeEnabled({ timeout: 15_000 });
  await messageBox(page).first().fill(text);
  await messageBox(page).first().press('Enter');
}

test('opens a folder, edits and saves a file, and chats with Claude', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await sendMessage(page, 'hi there');
    await expect(page.locator('.user-bubble')).toHaveText('hi there');
    await expect(page.locator('.assistant-text').last()).toContainText('Hello from fake Claude. You said: hi there');

    await page.getByRole('treeitem', { name: /hello\.md/ }).click();
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(editor).toContainText('# Hello');
    await editor.click();
    await page.keyboard.press('Meta+End');
    await page.keyboard.type('Saved from VISION');
    await expect(page.getByLabel('Unsaved changes')).toBeVisible();
    await page.keyboard.press('Meta+s');
    await expect.poll(() => readFileSync(join(folder, 'hello.md'), 'utf8')).toContain('Saved from VISION');
    await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);

    writeFileSync(join(folder, 'from-outside.md'), 'x');
    await expect(page.getByRole('treeitem', { name: /from-outside\.md/ })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/workspace.png' });
  } finally {
    await app.close();
  }
});

test('asks before a file change and answers questions', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await sendMessage(page, 'please edit notes');
    const card = page.getByRole('alertdialog', { name: 'Claude wants to change a file' });
    await expect(card).toBeVisible();
    await expect(card.locator('.diff-added')).toContainText('hello');
    await page.screenshot({ animations: 'disabled', path: 'test-results/permission.png' });
    await card.getByRole('button', { name: 'Allow' }).click();
    await expect(page.locator('.assistant-text').last()).toContainText('I wrote notes.txt.');
    await expect(page.getByRole('button', { name: /Wrote notes\.txt/ })).toBeVisible();

    await sendMessage(page, 'ask me');
    const question = page.getByRole('dialog', { name: 'Claude has a question' });
    await question.getByRole('button', { name: /Blue/ }).click();
    await question.getByRole('button', { name: 'Send Answer' }).click();
    await expect(page.locator('.assistant-text').last()).toContainText('You picked Blue.');
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat.png' });
  } finally {
    await app.close();
  }
});

test('switches a conversation between chat and terminal', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await expect(messageBox(page)).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'Terminal' }).click();
    await expect(page.locator('.xterm-rows')).toContainText('Fake Claude ready', { timeout: 15_000 });
    await page.getByRole('tab', { name: 'Chat' }).click();
    await expect(messageBox(page)).toBeEnabled({ timeout: 15_000 });
  } finally {
    await app.close();
  }
});

test('shows the Welcome screen when no folder is open', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'vision-userdata-'));
  const { app, page } = await launch(userData);
  try {
    await expect(page.getByRole('button', { name: 'Open Folder' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/welcome.png' });
  } finally {
    await app.close();
  }
});

test('closing a window with Claude running raises no errors in the main process', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await expect(messageBox(page)).toBeEnabled({ timeout: 15_000 });
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

test('pastes a screenshot into the chat and sends it', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await expect(messageBox(page).first()).toBeEnabled({ timeout: 15_000 });
    await messageBox(page).first().evaluate((area) => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
      area.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(page.getByAltText('Attached image 1')).toBeVisible();
    await sendMessage(page, 'what is this');
    await expect(page.getByAltText('Sent image 1')).toBeVisible();
    await expect(page.locator('.assistant-text').last()).toContainText('You said: what is this (1 image)');
    await expect(page.getByAltText('Attached image 1')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('opens, names, lists and closes several Claude sessions', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    // Sessions live in the sidebar's Claude view; Files shows first.
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('tabpanel', { name: 'Files' })).toBeVisible();
    await sidebar.getByRole('tab', { name: 'Claude' }).click();
    const sessions = sidebar.getByRole('tabpanel', { name: 'Claude' }).getByRole('button', { name: /^Claude session/ });
    await expect(sessions).toHaveCount(1, { timeout: 15_000 });
    // A conversation is named after its first message, in the sidebar and the tab.
    await sendMessage(page, 'Plan the launch');
    await expect(sessions.first()).toHaveAccessibleName('Claude session Plan the launch');
    await expect(page.locator('.dv-tab', { hasText: 'Plan the launch' })).toHaveCount(1);

    await page.getByRole('button', { name: 'New session' }).click();
    await expect(sessions).toHaveCount(2);
    await page.getByRole('button', { name: 'Open a new Claude terminal' }).click();
    await expect(sessions).toHaveCount(3);

    await sessions.first().hover();
    // The sidebar row's close button (the tab has one with the same name too).
    await page.getByRole('button', { name: 'Close Plan the launch', description: 'Close session' }).click();
    await expect(sessions).toHaveCount(2);
    await page.screenshot({ animations: 'disabled', path: 'test-results/sessions.png' });
  } finally {
    await app.close();
  }
});
