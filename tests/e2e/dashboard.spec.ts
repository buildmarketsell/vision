import { expect, test } from '@playwright/test';
import { launch, makeFixture, menu } from './helpers';

test('dashboard: a card from each feature, tick a to-do off, hide and move cards, kept after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    await page.evaluate(() => window.vision.todos.add('Write the VSL hook'));
    await menu(page).getByRole('tab', { name: 'Dashboard' }).click();
    const cards = page.locator('.dash-card');
    for (const title of ['To-do', 'Today', 'Claude usage', 'Content', 'Agents', 'Inbox', 'Focus']) {
      await expect(page.getByRole('region', { name: title })).toBeVisible({ timeout: 15_000 });
    }
    await page.screenshot({ animations: 'disabled', path: 'test-results/dashboard.png' });

    // Ticking a to-do off from its card.
    const todos = page.getByRole('region', { name: 'To-do' });
    await todos.getByRole('button', { name: 'Mark "Write the VSL hook" done' }).click();
    await expect(todos.getByText('All done.')).toBeVisible();

    // Customize: hide Inbox, move Focus up one place.
    await page.getByRole('button', { name: 'Customize' }).click();
    await page.getByRole('button', { name: 'Hide Inbox' }).click();
    await expect(page.getByRole('region', { name: 'Inbox' })).toHaveCount(0);
    const before = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
    const focusAt = before.indexOf('Focus');
    await page.getByRole('button', { name: 'Move Focus up' }).click();
    await expect.poll(() => cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')).indexOf('Focus'))).toBe(focusAt - 1);
    await page.screenshot({ animations: 'disabled', path: 'test-results/dashboard-customize.png' });
    await page.getByRole('button', { name: 'Done' }).click();
    const after = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));

    // The choices survive a restart.
    await app.close();
    ({ app, page } = await launch(userData));
    await menu(page).getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.getByRole('region', { name: 'To-do' })).toBeVisible({ timeout: 15_000 });
    expect(await page.locator('.dash-card').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(after);
  } finally {
    await app.close();
  }
});
