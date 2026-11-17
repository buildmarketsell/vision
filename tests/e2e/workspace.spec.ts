import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
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
    await expect(page.locator('.markdown-document h1')).toHaveText('Hello', { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/markdown-preview.png' });
    await page.getByRole('button', { name: 'Edit' }).click();
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

const DOT_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('shows images in a Markdown preview and saves pasted images next to the note', async () => {
  const { folder, userData } = makeFixture();
  mkdirSync(join(folder, 'images'));
  writeFileSync(join(folder, 'images', 'dot.png'), Buffer.from(DOT_PNG, 'base64'));
  writeFileSync(join(folder, 'dot two.png'), Buffer.from(DOT_PNG, 'base64'));
  writeFileSync(join(folder, 'pics.md'), '# Pics\n\n![](images/dot.png)\n\n![[dot two.png]]\n');
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('treeitem', { name: /pics\.md/ }).click();
    const images = page.locator('.markdown-document img');
    await expect(images).toHaveCount(2, { timeout: 15_000 });
    await expect.poll(() => images.evaluateAll((list) => list.map((img) => (img as HTMLImageElement).naturalWidth))).toEqual([1, 1]);

    await page.getByRole('button', { name: 'Edit' }).click();
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await page.keyboard.press('Meta+End');
    await page.locator('.monaco-editor textarea').first().evaluate(async (target, base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, DOT_PNG);
    await expect.poll(() => readdirSync(join(folder, 'images')).filter((name) => name.startsWith('pics-')).length).toBe(1);
    await expect(page.getByLabel('Unsaved changes')).toBeVisible();
    await page.keyboard.press('Meta+s');
    await expect.poll(() => readFileSync(join(folder, 'pics.md'), 'utf8')).toMatch(/!\[\]\(images\/pics-\d{8}-\d{6}\.png\)/);
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

    // Select like in Notion: start in the empty margin left of the first reply, drag across every message.
    const first = await page.locator('.assistant-text').first().boundingBox();
    const last = await page.locator('.assistant-text').last().boundingBox();
    if (!first || !last) throw new Error('chat messages not laid out');
    await page.mouse.move(first.x - 40, first.y - 30);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width, last.y + last.height + 20, { steps: 12 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    for (const text of ['I wrote notes.txt.', 'ask me', 'You picked Blue.']) expect(selected).toContain(text);
    await page.screenshot({ animations: 'disabled', path: 'test-results/selection.png' });
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
    await expect(page.locator('.xterm-rows')).toContainText('rgb:1c1c/1a1a/1919');

    await page.getByRole('button', { name: 'Light terminal' }).click();
    await expect(page.locator('.terminal-host .xterm-viewport')).toHaveCSS('background-color', 'rgb(247, 246, 243)');
    await page.getByRole('button', { name: 'Restart Claude' }).click();
    await expect(page.locator('.xterm-rows')).toContainText('rgb:f7f7/f6f6/f3f3', { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/terminal-light.png' });
    await page.getByRole('button', { name: 'Dark terminal' }).click();
    await expect(page.locator('.terminal-host .xterm-viewport')).toHaveCSS('background-color', 'rgb(28, 26, 25)');
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

test('slash commands, model picker, context meter and message queue', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await sendMessage(page, 'hi');
    await expect(page.locator('.assistant-text').last()).toContainText('You said: hi');
    await expect(page.getByRole('button', { name: /^Context \d+% used$/ })).toHaveCount(0);

    await messageBox(page).first().fill('/rev');
    const commands = page.getByRole('listbox', { name: 'Slash commands' });
    await expect(commands.getByRole('option')).toHaveCount(1);
    await messageBox(page).first().press('Enter');
    await expect(messageBox(page).first()).toHaveValue('/review ');
    await messageBox(page).first().fill('');

    await expect(page.locator('.chat-banner')).toHaveText(['Browser connected', 'Needs sign-in: Gmail']);
    await page.locator('.chat-banner').filter({ hasText: 'Browser connected' }).getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.locator('.chat-banner')).toHaveText(['Needs sign-in: Gmail']);

    await page.getByRole('button', { name: 'Opus 5.5 Medium' }).click();
    await page.getByRole('radiogroup', { name: 'Effort' }).getByRole('radio', { name: 'High' }).click();
    await expect(page.getByRole('button', { name: 'Opus 5.5 High' })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/effort.png' });
    await page.getByRole('listbox', { name: 'Model' }).getByRole('option', { name: /Haiku/ }).click();
    await expect(page.getByRole('button', { name: 'Haiku' })).toBeVisible();

    await sendMessage(page, 'slow one');
    await messageBox(page).first().fill('queued follow-up');
    await messageBox(page).first().press('Enter');
    await expect(page.getByLabel('Queued messages')).toContainText('queued follow-up');
    await page.screenshot({ animations: 'disabled', path: 'test-results/queue.png' });
    await page.getByRole('button', { name: 'Stop Claude' }).click();
    await expect(page.locator('.assistant-text').last()).toContainText('You said: queued follow-up');
    await expect(page.getByLabel('Queued messages')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('settings: the gear after the inbox switches the terminal appearance', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const tabs = page.locator('aside').getByRole('tab');
    await expect(tabs.last()).toHaveAccessibleName('Settings');
    await tabs.last().click();
    await page.getByRole('radiogroup', { name: 'Terminal appearance' }).getByRole('radio', { name: 'Light' }).click();
    await page.screenshot({ animations: 'disabled', path: 'test-results/settings.png' });
    await page.getByRole('tab', { name: 'Terminal' }).click();
    await expect(page.locator('.terminal-host .xterm-viewport')).toHaveCSS('background-color', 'rgb(247, 246, 243)');
  } finally {
    await app.close();
  }
});

test('themes: switch to Catppuccin Mocha in Settings, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    await sendMessage(page, 'hi there');
    await expect(page.locator('.assistant-text').last()).toContainText('You said: hi there');
    await page.locator('aside').getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Catppuccin Mocha' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(30, 30, 46)');
    await expect(page.locator('aside')).toHaveCSS('background-color', 'rgb(24, 24, 37)');
    await page.screenshot({ animations: 'disabled', path: 'test-results/theme-mocha.png' });
    await page.getByRole('tab', { name: 'Terminal' }).click();
    await expect(page.locator('.terminal-host .xterm-viewport')).toHaveCSS('background-color', 'rgb(24, 24, 37)');
    await page.locator('aside').getByRole('tab', { name: 'Files' }).click();
    await page.getByRole('treeitem', { name: /hello\.md/ }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.monaco-editor .monaco-editor-background').first()).toHaveCSS('background-color', 'rgb(30, 30, 46)', { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/theme-mocha-editor.png' });

    await app.close();
    ({ app, page } = await launch(userData));
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(30, 30, 46)');
    await page.locator('aside').getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'VISION Light' }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  } finally {
    await app.close();
  }
});

test('inbox: message yourself, mark done, delete, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    await page.locator('aside').getByRole('tab', { name: 'Inbox' }).click();
    const box = page.getByRole('textbox', { name: 'Message yourself' });
    await box.fill('Call the bank');
    await box.press('Enter');
    await box.fill('Renew the domain');
    await page.getByRole('button', { name: 'Send to inbox' }).click();
    const list = page.getByRole('log', { name: 'Inbox messages' });
    await expect(list.locator('.inbox-bubble')).toHaveCount(2);
    await expect(list.getByText('Today')).toBeVisible();

    await list.getByText('Call the bank').click({ button: 'right' });
    await page.getByText('Mark as done').click();
    await expect(list.locator('.inbox-bubble[data-done="true"]')).toHaveText(/Call the bank/);
    await page.screenshot({ animations: 'disabled', path: 'test-results/inbox.png' });
    await list.getByText('Renew the domain').click({ button: 'right' });
    await page.getByText('Delete').click();
    await expect(list.locator('.inbox-bubble')).toHaveCount(1);

    await app.close();
    ({ app, page } = await launch(userData));
    await page.locator('aside').getByRole('tab', { name: 'Inbox' }).click();
    await expect(page.getByRole('log', { name: 'Inbox messages' }).locator('.inbox-bubble[data-done="true"]')).toHaveText(/Call the bank/);
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
    // Claude names a conversation from its first message (like VS Code), in the sidebar and the tab.
    await sendMessage(page, 'Plan the launch');
    await expect(sessions.first()).toHaveAccessibleName('Claude session Launch planning');
    await expect(page.locator('.dv-tab', { hasText: 'Launch planning' })).toHaveCount(1);

    await page.getByRole('button', { name: 'New session' }).click();
    await expect(sessions).toHaveCount(2);
    await page.getByRole('button', { name: 'Open a new Claude terminal' }).click();
    await expect(sessions).toHaveCount(3);

    await sessions.first().hover();
    // The sidebar row's close button (the tab has one with the same name too).
    await page.getByRole('button', { name: 'Close Launch planning', description: 'Close session' }).click();
    await expect(sessions).toHaveCount(2);
    // Usage from the rate_limit_event lines, with the plan from initialize.
    const usage = sidebar.getByRole('region', { name: 'Usage' });
    await expect(usage.getByRole('meter', { name: 'Session (5 hr)' })).toHaveAttribute('aria-valuenow', '29');
    await expect(usage.getByRole('meter', { name: 'Weekly (7 day)' })).toHaveAttribute('aria-valuenow', '40');
    await expect(usage.getByText('Claude Pro')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/sessions.png' });
  } finally {
    await app.close();
  }
});

test('a file link in a Claude reply opens the file in a tab', async () => {
  const { folder, userData } = makeFixture();
  mkdirSync(join(folder, '👤 CLIENTS'));
  writeFileSync(join(folder, '👤 CLIENTS', 'brief.md'), '# The brief\n');
  const { app, page } = await launch(userData);
  try {
    await sendMessage(page, 'see [brief.md](%F0%9F%91%A4%20CLIENTS/brief.md#L1)');
    const link = page.locator('.assistant-text').last().getByRole('link', { name: 'brief.md' });
    await link.click();
    await expect(page.locator('.dv-tab', { hasText: /^brief\.md$/ })).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.markdown-document h1')).toHaveText('The brief', { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-file-link.png' });
  } finally {
    await app.close();
  }
});
