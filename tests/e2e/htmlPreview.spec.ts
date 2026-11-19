import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

test('an HTML file opens as the real page, with its CSS and scripts, and reloads when a file changes', async () => {
  const { folder, userData } = makeFixture();
  const site = join(folder, 'site');
  mkdirSync(site);
  writeFileSync(join(folder, '.env'), 'SECRET=nope\n');
  writeFileSync(join(site, 'style.css'), 'h1 { color: rgb(255, 0, 0); }\n');
  writeFileSync(join(site, 'app.js'), "document.querySelector('#out').textContent = 'script ran';\n" + "fetch('../.env').then((r) => (document.querySelector('#env').textContent = String(r.status))).catch(() => (document.querySelector('#env').textContent = 'blocked'));\n");
  writeFileSync(join(site, 'index.html'), '<!doctype html><link rel="stylesheet" href="style.css"><h1>Hello page</h1><p id="out"></p><p id="env"></p><script src="app.js"></script>\n');
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('treeitem', { name: /site/ }).click();
    await page.getByRole('treeitem', { name: /index\.html/ }).click();
    const preview = page.frameLocator('iframe[title="Preview of index.html"]');
    await expect(preview.getByRole('heading', { name: 'Hello page' })).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(preview.locator('#out')).toHaveText('script ran');
    // The page can't read hidden files such as .env.
    await expect(preview.locator('#env')).toHaveText(/403|blocked/);
    await page.screenshot({ animations: 'disabled', path: 'test-results/html-preview.png' });

    writeFileSync(join(site, 'style.css'), 'h1 { color: rgb(0, 0, 255); }\n');
    await expect(preview.getByRole('heading', { name: 'Hello page' })).toHaveCSS('color', 'rgb(0, 0, 255)', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await app.close();
  }
});
