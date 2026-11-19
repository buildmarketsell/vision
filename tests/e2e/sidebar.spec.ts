import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('the sidebar button and ⌘\\ hide and show the sidebar, and it stays hidden after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.locator('aside');
    const strip = page.locator('.dock-corner .dv-tabs-and-actions-container');
    await expect(page.locator('.dv-tabs-and-actions-container').first()).toHaveCSS('height', '36px');
    await expect(sidebar.getByRole('tab', { name: 'Files' })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/sidebar-open.png' });

    await page.getByRole('button', { name: 'Hide sidebar' }).click();
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
    await expect(strip).toHaveCSS('padding-left', '112px');
    await page.screenshot({ animations: 'disabled', path: 'test-results/sidebar-hidden.png' });

    await page.keyboard.press('Meta+Backslash');
    await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(100);
    await expect(strip).toHaveCSS('padding-left', '0px');

    await page.getByRole('button', { name: 'Hide sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible();
    // The layout is saved shortly after a change.
    await page.waitForTimeout(800);
    await app.close();
    ({ app, page } = await launch(userData));
    await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible();
  } finally {
    await app.close();
  }
});
