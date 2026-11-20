import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch, makeFixture, menu } from './helpers';

const pill = (kind: 'hover' | 'selected', scope: string) => `${scope} .glide-pill[data-kind='${kind}']`;

test('menu and file tree: highlights glide between rows; scrollbars show only while scrolling or pointed at', async () => {
  const { folder, userData } = makeFixture();
  mkdirSync(join(folder, 'many'));
  for (let index = 0; index < 60; index++) writeFileSync(join(folder, `file-${String(index).padStart(2, '0')}.md`), '');
  const { app, page } = await launch(userData);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    // Grain on both menus: pastel in the light theme, faint in the dark one.
    const grain = () => page.locator('.feature-menu').evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
    expect(await grain()).toContain('radial-gradient');
    await page.screenshot({ animations: 'disabled', path: 'test-results/grain-light.png' });
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: /Catppuccin/ }).click();
    await expect.poll(() => page.evaluate(() => 'themeReveal' in document.documentElement.dataset)).toBe(false);
    expect(await grain()).toContain('rgba(115, 0, 255, 0.2)');
    await page.screenshot({ animations: 'disabled', path: 'test-results/grain-dark.png' });

    // The selected pill sits under the picked menu row, and moves when another is picked.
    const selected = page.locator(pill('selected', '.menu-list'));
    const top = () => selected.evaluate((element) => element.getBoundingClientRect().top);
    const rowTop = (name: string) => menu(page).getByRole('tab', { name }).evaluate((element) => element.getBoundingClientRect().top);
    await expect.poll(async () => Math.abs((await top()) - (await rowTop('Settings')))).toBeLessThan(1);
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    await expect.poll(async () => Math.abs((await top()) - (await rowTop('Workspace')))).toBeLessThan(1);
    await menu(page).getByRole('tab', { name: 'Calendar' }).hover();
    await expect(page.locator(pill('hover', '.menu-list'))).toHaveAttribute('data-shown', 'true');

    // File tree: hover pill under the row, a guide line under an open folder.
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    const tree = page.getByRole('tree', { name: 'Files' });
    await tree.getByRole('treeitem', { name: 'notes' }).click();
    await expect(tree.locator('.tree-group')).toHaveCount(1);
    // Scrolling hides the hover pill, so start with the row in view.
    await tree.evaluate((element) => element.scrollTo(0, 0));
    await tree.getByRole('treeitem', { name: 'notes' }).hover();
    await expect(page.locator(pill('hover', '.file-tree'))).toHaveAttribute('data-shown', 'true');

    // Scrollbar: hidden at rest, shown while scrolling, hidden again after.
    await tree.evaluate((element) => element.scrollTo(0, 0));
    await expect(tree).not.toHaveAttribute('data-scrolling', { timeout: 3000 });
    await tree.evaluate((element) => element.scrollBy(0, 200));
    await expect(tree).toHaveAttribute('data-scrolling', '');
    await tree.screenshot({ path: 'test-results/motion-scrolling.png' });
    await expect(tree).not.toHaveAttribute('data-scrolling', { timeout: 3000 });
    const box = await tree.boundingBox();
    if (!box) throw new Error('The file tree has no size');
    await page.mouse.move(box.x + box.width - 4, box.y + 100);
    await expect(tree).toHaveAttribute('data-scrollbar-hover', '');
    await tree.screenshot({ path: 'test-results/motion-scrollbar-hover.png' });
    await page.mouse.move(box.x + 40, box.y + 100);
    await expect(tree).not.toHaveAttribute('data-scrollbar-hover');
    await page.screenshot({ path: 'test-results/motion-rest.png' });
    await tree.screenshot({ path: 'test-results/motion-tree-rest.png' });
  } finally {
    await app.close();
  }
});
