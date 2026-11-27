import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, makeFixture, menu } from './helpers';

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

    // Copying from the chat gives plain text only, so Google Docs pastes it in the doc's own style.
    const copied = await page.locator('.assistant-text').last().evaluate((reply) => {
      window.getSelection()?.selectAllChildren(reply);
      const data = new DataTransfer();
      reply.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
      return { types: [...data.types], text: data.getData('text/plain') };
    });
    expect(copied.types).toEqual(['text/plain']);
    expect(copied.text).toContain('Hello from fake Claude. You said: hi there');

    // Copy icons like VS Code: one in each code block's corner and one under the reply, both quiet until hovered.
    // The clipboard is recorded in the page, so the test never touches the Mac's real clipboard.
    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { copies });
      navigator.clipboard.writeText = async (value: string) => void copies.push(value);
    });
    await sendMessage(page, 'show me a snippet');
    const snippet = page.locator('.assistant-text').last();
    await expect(snippet.locator('pre')).toContainText('<p class="quote">Hi</p>');
    const codeCopy = snippet.getByRole('button', { name: 'Copy code' });
    await expect(codeCopy).toHaveCSS('opacity', '0');
    await snippet.locator('.code-wrap').hover();
    await expect(codeCopy).toHaveCSS('opacity', '1');
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-copy-code.png' });
    await codeCopy.click();
    await expect(snippet.getByRole('button', { name: 'Copied' })).toBeVisible();
    await snippet.getByRole('button', { name: 'Copy reply' }).click();
    const copies = await page.evaluate(() => (window as unknown as { copies: string[] }).copies);
    expect(copies[0]).toBe('<p class="quote">Hi</p>\n');
    expect(copies[1]).toBe('Paste this where the quote goes.\n\n<p class="quote">Hi</p>\n\nThat is all.');

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
    await expect(page.locator('.tool-row', { hasText: 'Wrote notes.txt' }).getByRole('button', { name: 'notes.txt' })).toBeVisible();

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

test('slash commands, model picker, context meter, and messages sent while Claude works', async () => {
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

    await expect(page.locator('.chat-banner')).toHaveText(['Browser connected']);
    await page.locator('.chat-banner').getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.locator('.chat-banner')).toHaveCount(0);

    await page.getByRole('button', { name: 'Opus 5.5 Medium' }).click();
    await page.getByRole('radiogroup', { name: 'Effort' }).getByRole('radio', { name: 'High' }).click();
    await expect(page.getByRole('button', { name: 'Opus 5.5 High' })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/effort.png' });
    await page.getByRole('listbox', { name: 'Model' }).getByRole('option', { name: /Haiku/ }).click();
    await expect(page.getByRole('button', { name: 'Haiku' })).toBeVisible();

    // The "/" button opens the actions menu: filter, then pick with the keyboard or the mouse.
    await page.getByRole('button', { name: 'Actions' }).click();
    const actions = page.getByRole('dialog', { name: 'Actions' });
    await expect(actions.getByRole('textbox', { name: 'Filter actions' })).toBeFocused();
    await expect(actions.getByText('Context', { exact: true })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/actions-menu.png' });
    await page.keyboard.type('plan');
    await page.keyboard.press('Enter');
    await expect(actions).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Permission mode' })).toHaveValue('plan');
    await page.getByRole('button', { name: 'Actions' }).click();
    await actions.getByRole('option', { name: /\/review/ }).click();
    await expect(messageBox(page).first()).toHaveValue('/review ');
    await messageBox(page).first().fill('');

    // A message sent while Claude works goes to Claude at once (it fits it into the same job), like Claude Code in VS Code.
    await sendMessage(page, 'slow one');
    await expect(page.getByRole('button', { name: 'Stop Claude' })).toBeVisible();
    await messageBox(page).first().fill('follow-up while working');
    await page.screenshot({ animations: 'disabled', path: 'test-results/send-mid-task.png' });
    await messageBox(page).first().press('Enter');
    await expect(page.locator('.user-bubble').last()).toHaveText('follow-up while working');
    await expect(page.locator('.assistant-text').last()).toContainText('You said: follow-up while working');
    await expect(page.getByLabel('Queued messages')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('settings: the last item in the menu switches the terminal appearance', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const tabs = menu(page).getByRole('tab');
    await expect(tabs.last()).toHaveAccessibleName('Settings');
    await tabs.last().click();
    await page.getByRole('radiogroup', { name: 'Terminal appearance' }).getByRole('radio', { name: 'Light' }).click();
    await page.screenshot({ animations: 'disabled', path: 'test-results/settings.png' });
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
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
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Catppuccin Mocha' }).click();
    // The page is painted; the window behind the menus is see-through for macOS's glass, tinted per theme.
    await expect(page.locator('.app-shell > main').first()).toHaveCSS('background-color', 'rgb(30, 30, 46)');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(menu(page)).toHaveCSS('background-color', 'rgba(24, 24, 37, 0.18)');
    await page.screenshot({ animations: 'disabled', path: 'test-results/theme-mocha.png' });
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    await page.getByRole('tab', { name: 'Terminal' }).click();
    await expect(page.locator('.terminal-host .xterm-viewport')).toHaveCSS('background-color', 'rgb(24, 24, 37)');
    await page.getByRole('treeitem', { name: /hello\.md/ }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.monaco-editor .monaco-editor-background').first()).toHaveCSS('background-color', 'rgb(30, 30, 46)', { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/theme-mocha-editor.png' });

    await app.close();
    ({ app, page } = await launch(userData));
    await expect(page.locator('.app-shell > main').first()).toHaveCSS('background-color', 'rgb(30, 30, 46)');
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'VISION Light' }).click();
    await expect(page.locator('.app-shell > main').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  } finally {
    await app.close();
  }
});

test('inbox: message yourself, mark done, delete, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    await menu(page).getByRole('tab', { name: 'Inbox' }).click();
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
    await menu(page).getByRole('tab', { name: 'Inbox' }).click();
    await expect(page.getByRole('log', { name: 'Inbox messages' }).locator('.inbox-bubble[data-done="true"]')).toHaveText(/Call the bank/);
  } finally {
    await app.close();
  }
});

test('the Claude view shows usage on top and reopens past chats', async () => {
  const { folder, userData } = makeFixture();
  const projectsDir = mkdtempSync(join(tmpdir(), 'vision-transcripts-'));
  const transcripts = join(projectsDir, folder.replace(/[^a-zA-Z0-9]/g, '-'));
  mkdirSync(transcripts);
  const lines = [
    { type: 'user', message: { role: 'user', content: 'Plan the old launch' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Here is the old plan.' }] } },
    { type: 'ai-title', aiTitle: 'Old launch plan' },
  ];
  writeFileSync(join(transcripts, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jsonl'), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  const { app, page } = await launch(userData, projectsDir);
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    const tabs = sidebar.getByRole('tablist', { name: 'Workspace' }).getByRole('tab');
    await expect(tabs).toHaveCount(3);
    expect(await tabs.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))).toEqual(['Files', 'Claude', 'Calendar']);
    await page.screenshot({ animations: 'disabled', path: 'test-results/workspace-tabs.png' });

    // With the menu hidden in a wide window, the new-chat screen sits in the same centered column as the message box.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.keyboard.press('Meta+\\');
    const empty = page.locator('.chat-empty');
    await expect(empty.getByText('Old launch plan')).toBeVisible({ timeout: 15_000 });
    const emptyBox = await empty.boundingBox();
    const dockBox = await page.locator('.chat-dock').boundingBox();
    expect(emptyBox && dockBox && Math.abs(emptyBox.x - dockBox.x) < 2 && Math.abs(emptyBox.width - dockBox.width) < 2).toBe(true);
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-empty-wide.png' });
    await page.keyboard.press('Meta+\\');
    await tabs.nth(1).click();
    const view = sidebar.getByRole('tabpanel', { name: 'Claude' });
    const usage = view.getByRole('region', { name: 'Usage' });
    const pastChat = view.getByRole('button', { name: /Old launch plan/ });
    await expect(pastChat).toBeVisible({ timeout: 15_000 });
    const usageBox = await usage.boundingBox();
    const listBox = await view.getByText('Past chats').boundingBox();
    expect(usageBox && listBox && usageBox.y < listBox.y).toBe(true);

    // A past chat opens in a new tab with its messages; clicking it again goes back to that tab.
    const tabsBefore = await page.locator('.dv-tab').count();
    await pastChat.click();
    await expect(page.locator('.dv-tab', { hasText: 'Old launch plan' })).toHaveCount(1);
    await expect(page.getByText('Here is the old plan.')).toBeVisible();
    await expect(pastChat).toHaveAttribute('data-selected', 'true');
    await pastChat.click();
    await expect(page.locator('.dv-tab')).toHaveCount(tabsBefore + 1);

    await view.getByRole('button', { name: /New chat/ }).click();
    await expect(page.locator('.dv-tab')).toHaveCount(tabsBefore + 2);

    // Usage from the rate_limit_event lines, with the plan from initialize.
    await sendMessage(page, 'Plan the launch');
    await expect(usage.getByRole('meter', { name: 'Session (5 hr)' })).toHaveAttribute('aria-valuenow', '29');
    await expect(usage.getByRole('meter', { name: 'Weekly (7 day)' })).toHaveAttribute('aria-valuenow', '40');
    await expect(usage.getByText('Claude Pro')).toBeVisible();
    // Another chat is showing now, so the old one is no longer highlighted.
    await expect(pastChat).toHaveAttribute('data-selected', 'false');
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

test('tab bar looks like Notion: rounded tabs, gray only when open, and + opens a new tab', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const tabs = page.locator('.vision-dock .dv-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
    const before = await tabs.count();
    await page.getByRole('button', { name: 'New tab' }).first().click();
    await expect(tabs).toHaveCount(before + 1);
    await page.mouse.move(600, 400);
    await page.screenshot({ animations: 'disabled', path: 'test-results/notion-tabs.png' });

    const look = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
      return {
        bar: style('.vision-dock .dv-tabs-and-actions-container').backgroundColor,
        page: style('.vision-dock .dv-groupview').backgroundColor,
        radius: style('.vision-dock .dv-active-tab').borderTopLeftRadius,
        active: style('.vision-dock .dv-active-tab').backgroundColor,
        inactive: style('.vision-dock .dv-inactive-tab').backgroundColor,
      };
    });
    expect(look.bar).toBe(look.page);
    expect(look.radius).toBe('8px');
    expect(look.active).not.toBe(look.bar);
    expect(look.inactive).toBe('rgba(0, 0, 0, 0)');
  } finally {
    await app.close();
  }
});

test('chat background: picked in Settings, drawn only beside the chat, gone when Off', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    // Menu and sidebar hidden: the chat gets the whole window, with room on both sides.
    await expect(messageBox(page).first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Meta+Backslash');
    await page.keyboard.press('Meta+Shift+Backslash');
    const backdrop = page.locator('.chat-backdrop');
    await expect(backdrop).toHaveAttribute('data-backdrop', 'dither');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/chat-backdrop-dither.png' });

    for (const name of ['Dots', 'Grid', 'Matrix'] as const) {
      await page.keyboard.press('Meta+Backslash');
      await menu(page).getByRole('tab', { name: 'Settings' }).click();
      await page.getByRole('radiogroup', { name: 'Chat background' }).getByRole('radio', { name }).click();
      await menu(page).getByRole('tab', { name: 'Workspace' }).click();
      await page.keyboard.press('Meta+Backslash');
      await expect(backdrop).toHaveAttribute('data-backdrop', name.toLowerCase());
      await page.waitForTimeout(700);
      const painted = await backdrop.evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        const alphaIn = (x: number) => {
          const data = ctx?.getImageData(x, 0, 40, canvas.height).data ?? [];
          let sum = 0;
          for (let i = 3; i < data.length; i += 4) sum += data[i] ?? 0;
          return sum;
        };
        return { side: alphaIn(0), middle: alphaIn(Math.floor(canvas.width / 2) - 20) };
      });
      expect(painted.side).toBeGreaterThan(0);
      expect(painted.middle).toBe(0);
      await page.screenshot({ path: `test-results/chat-backdrop-${name.toLowerCase()}.png` });
    }

    await page.keyboard.press('Meta+Backslash');
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Chat background' }).getByRole('radio', { name: 'Off' }).click();
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    await expect(backdrop).toHaveCount(0);
  } finally {
    await app.close();
  }
});
