import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { startFakeGoogle } from './fixtures/fake-google';
import { connectFakeGoogle, launch, makeFixture, menu } from './helpers';

/** The island is its own window (island.html); headless, it never shows on screen but its page still runs. */
async function islandPage(app: ElectronApplication): Promise<Page> {
  await expect.poll(() => app.windows().some((window) => window.url().includes('island.html')), { timeout: 10_000 }).toBe(true);
  const island = app.windows().find((window) => window.url().includes('island.html'));
  if (!island) throw new Error('No island window');
  return island;
}

// A focus "minute" lasts 1 second here, so countdowns end during the test.
const FAST = { VISION_FOCUS_TEST_MINUTE_MS: '1000' };

test('focus: start on a to-do, see it in progress and in the island, then answer the check-in with Done and with Not yet', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, FAST);
  try {
    await menu(page).getByRole('tab', { name: 'To-do' }).click();
    const todos = page.locator('main .todo-page');
    const add = todos.getByRole('textbox', { name: 'Add a to-do' });
    for (const text of ['Write the advertorial', 'Edit the reel']) {
      await add.fill(text);
      await add.press('Enter');
    }

    // Hover button → picker → a 3-minute focus (3 s here).
    await todos.getByRole('listitem').filter({ hasText: 'Write the advertorial' }).hover();
    await todos.getByRole('button', { name: 'Focus on "Write the advertorial"' }).click();
    const picker = page.getByRole('form', { name: 'Start a focus' });
    await expect(picker.getByRole('button', { name: /25/ })).toBeFocused();
    await page.screenshot({ animations: 'disabled', path: 'test-results/focus-picker.png' });
    await picker.getByRole('textbox', { name: 'Other length, in minutes' }).fill('3');
    await picker.getByRole('button', { name: 'Start' }).click();

    const row = todos.getByRole('listitem').filter({ hasText: 'Write the advertorial' });
    await expect(row.locator('.todo-tag')).toHaveText('In progress');
    await expect(row.locator('.focus-chip')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/focus-todo-chip.png' });

    const island = await islandPage(app);
    await island.setViewportSize({ width: 460, height: 200 });
    await expect(island.getByRole('status', { name: /Focus: Write the advertorial/ })).toBeVisible();
    await island.locator('.island').hover();
    await expect(island.locator('.island-panel')).toHaveCSS('opacity', '1');
    await island.screenshot({ path: 'test-results/focus-island.png' });

    // The countdown ends: the check-in opens on its own; Done ticks the to-do off.
    await expect(island.getByRole('button', { name: 'Done' })).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('.focus-chip')).toHaveText(/Done\?/);
    await island.screenshot({ path: 'test-results/focus-island-check-in.png' });
    await island.getByRole('button', { name: 'Done' }).click();
    await expect(todos.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveText([/Edit the reel/]);

    // Right-click → Focus… → a 1-minute focus; at the check-in, Not yet → 1 hour plans an hour for it.
    await todos.getByRole('listitem').filter({ hasText: 'Edit the reel' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Focus…' }).click();
    await picker.getByRole('textbox', { name: 'Other length, in minutes' }).fill('1');
    await picker.getByRole('textbox', { name: 'Other length, in minutes' }).press('Enter');
    await expect(island.getByRole('button', { name: 'Not yet' })).toBeVisible({ timeout: 10_000 });
    await island.getByRole('button', { name: 'Not yet' }).click();
    await island.screenshot({ path: 'test-results/focus-island-not-yet.png' });
    await island.getByRole('button', { name: '1 hour' }).click();
    const reel = todos.getByRole('listitem').filter({ hasText: 'Edit the reel' });
    await expect(reel.getByRole('button', { name: 'Schedule of "Edit the reel"' })).toContainText('1h');
    await expect(island.getByRole('status')).toHaveCount(0);

    // A check-in can be closed with Stop, leaving the to-do as it is.
    await reel.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Focus…' }).click();
    await picker.getByRole('textbox', { name: 'Other length, in minutes' }).fill('1');
    await picker.getByRole('textbox', { name: 'Other length, in minutes' }).press('Enter');
    await expect(island.getByRole('button', { name: 'Not yet' })).toBeVisible({ timeout: 10_000 });
    await island.getByRole('button', { name: 'Stop' }).click();
    await expect(island.getByRole('status')).toHaveCount(0);
    await expect(todos.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveText([/Edit the reel/]);

    // Nothing left running.
    const view = await page.evaluate(() => window.vision.focus.view());
    expect(view.glance).toEqual({ kind: 'idle' });
  } finally {
    await app.close();
  }
});

test('focus: a stopwatch from ⌘K, paused and stopped from the island', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await expect(page.locator('.dv-tab').first()).toBeVisible();
    await page.keyboard.press('Meta+k');
    const box = page.getByRole('dialog', { name: 'Search VISION' });
    await box.getByRole('combobox').fill('stopwatch');
    await expect(box.getByRole('option', { name: /Start stopwatch/ })).toBeVisible();
    await page.keyboard.press('Enter');
    const island = await islandPage(app);
    await expect(island.getByRole('status', { name: /Focus: Focus, 0:0/ })).toBeVisible();
    await island.locator('.island').hover();
    await island.getByRole('button', { name: 'Pause' }).click();
    await expect(island.locator('.island-clock')).toHaveAttribute('data-paused', 'true');
    await island.getByRole('button', { name: 'Stop' }).click();
    await expect(island.getByRole('status')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('heads-up: five minutes before a meeting the island counts down and Join opens its Meet link', async () => {
  const google = await startFakeGoogle({ meetingInMinutes: 3 });
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as { opened?: string[] }).opened = opened;
      shell.openExternal = async (url: string) => {
        opened.push(url);
      };
    });
    await connectFakeGoogle(page.getByRole('complementary', { name: 'Sidebar' }));
    const island = await islandPage(app);
    await island.setViewportSize({ width: 460, height: 200 });
    const status = island.getByRole('status', { name: 'Call with Kilo' });
    await expect(status).toBeVisible({ timeout: 15_000 });
    await expect(island.locator('.island-clock')).toHaveText(/^[23]:\d\d$/);
    await island.locator('.island').hover();
    await expect(island.locator('.island-panel')).toHaveCSS('opacity', '1');
    await island.screenshot({ path: 'test-results/focus-island-meeting.png' });
    await island.getByRole('button', { name: 'Join' }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as { opened?: string[] }).opened)).toEqual(['https://meet.google.com/abc-defg-hij']);
    await island.getByRole('button', { name: 'Hide' }).click();
    await expect(island.getByRole('status')).toHaveCount(0);
  } finally {
    await app.close();
    await google.close();
  }
});
