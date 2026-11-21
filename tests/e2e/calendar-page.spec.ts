import { expect, test } from '@playwright/test';
import { startFakeGoogle } from './fixtures/fake-google';
import { connectFakeGoogle, launch, makeFixture } from './helpers';

test('calendar page: Calendar in the menu fills the window with the week, see events, click an empty slot to add one', async () => {
  const google = await startFakeGoogle();
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await connectFakeGoogle(sidebar);
    // Picking Calendar in the menu (connectFakeGoogle does) fills the window with the week.
    await expect(page.locator('main .calendar-page')).toBeVisible();

    const calendar = page.locator('.calendar-page');
    await expect(calendar.locator('.week-event', { hasText: 'Call with the garage' })).toBeVisible();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(1);
    await expect(calendar.locator('.week-now')).toHaveCount(1);
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-week.png' });

    const today = calendar.locator('.week-column[data-today="true"]');
    const box = await today.boundingBox();
    if (!box) throw new Error('no today column');
    // The fake garage call sits two hours from now (on the hour); between 20:00 and 21:00 that is 22:00, so click 20:00 instead.
    const hour = new Date(Date.now() + 2 * 60 * 60_000).getHours() === 22 ? 20 : 22;
    await page.mouse.click(box.x + box.width / 2, box.y + hour * 48 + 10);
    const form = page.locator('.calendar-popover').getByRole('form', { name: 'New event' });
    await expect(form.getByRole('textbox', { name: 'Start time' })).toHaveValue(`${hour}:00`);
    await form.getByRole('textbox', { name: 'Event name' }).fill('Plan the week');
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-week-new.png' });
    await form.getByRole('button', { name: 'Add event' }).click();
    await expect(calendar.locator('.week-event', { hasText: 'Plan the week' })).toBeVisible();
    expect(google.created[0]).toMatchObject({ summary: 'Plan the week' });

    // Drag from 16:00 down to 17:20: the form gets 16:00–17:30 (each end covers its quarter hour).
    const column = calendar.locator('.week-column').nth(1);
    await column.scrollIntoViewIfNeeded();
    const scroller = calendar.locator('.week-scroll');
    await scroller.evaluate((element) => (element.scrollTop = 14 * 48));
    const area = await column.boundingBox();
    if (!area) throw new Error('no column');
    await page.mouse.move(area.x + area.width / 2, area.y + 16 * 48 + 5);
    await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2, area.y + 17 * 48 + 20, { steps: 6 });
    await expect(calendar.locator('.week-selection')).toHaveText('16:00 – 17:30');
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-drag.png' });
    await page.mouse.up();
    const dragged = page.locator('.calendar-popover').getByRole('form', { name: 'New event' });
    await expect(dragged.getByRole('textbox', { name: 'Start time' })).toHaveValue('16:00');
    await expect(dragged.getByRole('textbox', { name: 'End time' })).toHaveValue('17:30');
    await expect(calendar.locator('.week-selection')).toHaveCount(1);
    await dragged.getByRole('button', { name: 'Cancel' }).click();
    await expect(calendar.locator('.week-selection')).toHaveCount(0);

    await calendar.getByRole('button', { name: 'Next week' }).click();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(0);
    await calendar.getByRole('button', { name: 'Today' }).click();
    await expect(calendar.locator('.week-day-head[data-today="true"]')).toHaveCount(1);
  } finally {
    await app.close();
    google.close();
  }
});
