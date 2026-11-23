import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('with every tab closed, the workspace shows the topo map and a button that starts a Claude chat', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const tabs = page.locator('.dv-tab');
    await expect(tabs.first()).toBeVisible();
    for (let left = await tabs.count(); left > 0; left = await tabs.count()) {
      await page.keyboard.press('Meta+w');
      await expect(tabs).toHaveCount(left - 1);
    }

    const start = page.getByRole('button', { name: /New Claude chat/ });
    await expect(start).toBeVisible();
    const box = await start.boundingBox();
    const dock = await page.locator('.empty-dock').boundingBox();
    // Centered in the empty area.
    expect(Math.abs(box!.x + box!.width / 2 - (dock!.x + dock!.width / 2))).toBeLessThan(2);
    expect(Math.abs(box!.y + box!.height / 2 - (dock!.y + dock!.height / 2))).toBeLessThan(2);
    // The map is drawn: the canvas has lines on it.
    await expect
      .poll(() =>
        page.locator('.topo-canvas').evaluate((canvas: HTMLCanvasElement) => {
          const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          let inked = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) inked++;
          return inked;
        }),
      )
      .toBeGreaterThan(1000);
    await page.screenshot({ animations: 'disabled', path: 'test-results/empty-dock.png' });

    // Same with the menu and sidebar hidden, as Dan uses it.
    await page.getByRole('button', { name: 'Hide menu' }).click();
    await page.getByRole('button', { name: 'Hide sidebar' }).click();
    await page.mouse.move(400, 400);
    await expect(start).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ animations: 'disabled', path: 'test-results/empty-dock-full.png' });

    await start.click();
    await expect(tabs).toHaveCount(1);
    await expect(page.locator('.empty-dock')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
