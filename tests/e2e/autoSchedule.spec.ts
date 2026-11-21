import { expect, test } from '@playwright/test';
import { startFakeGoogle } from './fixtures/fake-google';
import { connectFakeGoogle, launch, makeFixture, menu } from './helpers';

test('auto-schedule: give a to-do a duration, see it planned on the week, copy it to Google, mark it done', async () => {
  const google = await startFakeGoogle();
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await connectFakeGoogle(page.getByRole('complementary', { name: 'Sidebar' }));
    // Personal hours all day, every day, so the test never depends on what time it runs.
    await page.evaluate(async () => {
      const allDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, { from: '00:00', to: '23:59' }]));
      await window.vision.plan.setSettings({ enabled: true, hours: { work: {}, personal: allDay }, calendarKey: null });
    });

    // To-do: right-click → Schedule… → 1h 30m, High.
    await menu(page).getByRole('tab', { name: 'To-do' }).click();
    const todo = page.locator('main .todo-page');
    const add = todo.getByRole('textbox', { name: 'Add a to-do' });
    await add.fill('Write the VSL');
    await add.press('Enter');
    await todo.getByRole('listitem').filter({ hasText: 'Write the VSL' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Schedule…' }).click();
    const form = page.getByRole('form', { name: 'Schedule to-do' });
    await form.getByRole('combobox', { name: 'How long' }).selectOption('90');
    await form.getByRole('radio', { name: 'High' }).click();
    await page.screenshot({ animations: 'disabled', path: 'test-results/auto-schedule-form.png' });
    await form.getByRole('button', { name: 'Schedule' }).click();
    const chips = todo.getByRole('button', { name: 'Schedule of "Write the VSL"' });
    await expect(chips).toContainText('1h 30m');
    await expect(chips).toContainText('High');
    await expect(chips.locator('.todo-plan-when')).not.toHaveText('Planning…');
    await page.screenshot({ animations: 'disabled', path: 'test-results/auto-schedule-todo.png' });

    // Calendar: the planned block is on the week (the next week if it landed there, e.g. late on a Sunday).
    await menu(page).getByRole('tab', { name: 'Calendar' }).click();
    const calendar = page.locator('main .calendar-page');
    const firstStart = await page.evaluate(async () => (await window.vision.plan.state()).blocks[0]?.start ?? 0);
    const nextMonday = await page.evaluate(() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
      return date.getTime();
    });
    if (firstStart >= nextMonday) await calendar.getByRole('button', { name: 'Next week' }).click();
    const block = calendar.locator('.week-event[data-planned]', { hasText: 'Write the VSL' }).first();
    await block.scrollIntoViewIfNeeded();
    await expect(block).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/auto-schedule-week.png' });

    // Plan settings: copy the blocks to the Google calendar; each one is tagged as VISION's.
    await calendar.getByRole('button', { name: 'Plan settings' }).click();
    const settings = page.getByRole('form', { name: 'Plan settings' });
    await expect(settings.getByRole('checkbox', { name: 'Plan my to-dos automatically' })).toBeChecked();
    await settings.getByRole('combobox', { name: 'Copy planned blocks to' }).selectOption({ label: 'dan@example.com' });
    await page.screenshot({ animations: 'disabled', path: 'test-results/auto-schedule-settings.png' });
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings).toBeHidden();
    const copied = google.created.filter((event) => event['summary'] === 'Write the VSL');
    expect(copied.length).toBeGreaterThan(0);
    expect(copied[0]).toMatchObject({ extendedProperties: { private: { visionBlock: '1' } } });
    // Planning again with nothing changed writes nothing new.
    const writes = google.created.length;
    await page.evaluate(() => window.vision.plan.run());
    expect(google.created.length).toBe(writes);
    // The copies in Google aren't drawn twice: only the planned blocks show.
    await expect(calendar.locator('.week-event:not([data-planned])', { hasText: 'Write the VSL' })).toHaveCount(0);

    // Mark done: the block leaves the week and Google.
    await block.click();
    await page.getByRole('dialog', { name: 'Planned task' }).getByRole('button', { name: 'Mark done' }).click();
    await expect(calendar.locator('.week-event[data-planned]', { hasText: 'Write the VSL' })).toHaveCount(0);
    await expect.poll(() => google.deleted.length + google.patched.length, { timeout: 10_000 }).toBeGreaterThan(0);
  } finally {
    await app.close();
    google.close();
  }
});
