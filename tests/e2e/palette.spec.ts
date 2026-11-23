import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('⌘K opens a search box that finds places, commands and files, and runs the picked one', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const box = page.getByRole('dialog', { name: 'Search VISION' });
    const input = box.getByRole('combobox');
    await expect(page.locator('.dv-tab').first()).toBeVisible();

    // Empty: places and commands, with their shortcuts.
    await page.keyboard.press('Meta+k');
    await expect(box).toBeVisible();
    await expect(input).toBeFocused();
    await expect(box.getByRole('group', { name: 'Places' }).getByRole('option', { name: /To-do/ })).toBeVisible();
    await expect(box.getByRole('option', { name: /New Claude Session.*⌘T/ })).toBeVisible();
    // A long list scrolls; the search field and the footer keep their height.
    await expect(box.locator('.palette-search')).toHaveCSS('height', '56px');
    await expect(box.locator('.palette-footer')).toHaveCSS('height', '40px');
    await page.screenshot({ animations: 'disabled', path: 'test-results/palette-empty.png' });

    // Esc and ⌘K again both close it.
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await page.keyboard.press('Meta+k');
    await page.keyboard.press('Meta+k');
    await expect(box).toHaveCount(0);

    // Typing finds a file; Enter opens it in a tab.
    await page.keyboard.press('Meta+k');
    await input.fill('hello');
    const file = box.getByRole('group', { name: 'Files' }).getByRole('option', { name: /hello\.md/ });
    await expect(file).toBeVisible();
    await expect(file).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ animations: 'disabled', path: 'test-results/palette-files.png' });
    await page.keyboard.press('Enter');
    await expect(box).toHaveCount(0);
    await expect(page.locator('.dv-tab', { hasText: /^hello\.md$/ })).toHaveCount(1);

    // Arrow down to a place and Enter switches to it.
    await page.keyboard.press('Meta+k');
    await input.fill('to-do');
    await expect(box.getByRole('option', { name: /To-do/ }).first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'To-do' })).toHaveAttribute('aria-selected', 'true');

    // Nothing found says so.
    await page.keyboard.press('Meta+k');
    await input.fill('zzqqxx');
    await expect(box.getByText('Nothing found for “zzqqxx”.')).toBeVisible();
  } finally {
    await app.close();
  }
});
