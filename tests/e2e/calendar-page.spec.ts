import { expect, test } from '@playwright/test';
import { startFakeGoogle } from './fixtures/fake-google';
import { connectFakeGoogle, launch, makeFixture } from './helpers';

test('calendar page: open the week from the sidebar, see events, click an empty slot to add one', async () => {
  const google = await startFakeGoogle();
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sidebar = page.locator('aside');
    await connectFakeGoogle(sidebar);
    await sidebar.getByRole('button', { name: 'Open calendar' }).click();

    const calendar = page.locator('.calendar-page');
    await expect(calendar.locator('.week-event', { hasText: 'Call with the garage' })).toBeVisible();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(1);
    await expect(calendar.locator('.week-now')).toHaveCount(1);
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-week.png' });

    const today = calendar.locator('.week-column[data-today="true"]');
    const box = await today.boundingBox();
    if (!box) throw new Error('no today column');
    await page.mouse.click(box.x + box.width / 2, box.y + 22 * 48 + 10);
    const form = page.locator('.calendar-popover').getByRole('form', { name: 'New event' });
    await expect(form.getByRole('textbox', { name: 'Start time' })).toHaveValue('22:00');
    await form.getByRole('textbox', { name: 'Event name' }).fill('Plan the week');
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-week-new.png' });
    await form.getByRole('button', { name: 'Add event' }).click();
    await expect(calendar.locator('.week-event', { hasText: 'Plan the week' })).toBeVisible();
    expect(google.created[0]).toMatchObject({ summary: 'Plan the week' });

    await calendar.getByRole('button', { name: 'Next week' }).click();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(0);
    await calendar.getByRole('button', { name: 'Today' }).click();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(1);
  } finally {
    await app.close();
    google.close();
  }
});
