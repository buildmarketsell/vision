import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('notion view: takes over the window, writes a page with shortcuts and "/", sub-pages, favorites, and keeps it all', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.locator('aside');
    await expect(page.getByRole('tab', { name: /Claude/ }).first()).toBeVisible();
    await sidebar.getByRole('tab', { name: 'Notion' }).click();
    await expect(page.getByText('Pick a page on the left, or start a new one.')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Open a new Claude terminal' })).toHaveCount(0);

    await page.getByRole('main').getByRole('button', { name: 'New page' }).click();
    await page.getByRole('textbox', { name: 'Page title' }).fill('LIFE OS');
    await page.keyboard.press('Enter');
    await page.keyboard.type('# Navigation');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] Plan the week');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Film the reel');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Quick note');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Nested idea');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('/call');
    await expect(page.getByRole('option', { name: /Callout/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Remember: sleep before 23:00');

    const blocks = page.locator('.notion-blocks');
    await expect(blocks.getByRole('textbox', { name: 'Heading 1' })).toHaveValue('Navigation');
    await expect(blocks.getByRole('textbox', { name: 'To-do list' }).nth(0)).toHaveValue('Plan the week');
    await expect(blocks.getByRole('textbox', { name: 'To-do list' }).nth(1)).toHaveValue('Film the reel');
    await expect(blocks.getByRole('textbox', { name: 'Bulleted list' }).nth(0)).toHaveValue('Quick note');
    await expect(blocks.getByRole('textbox', { name: 'Bulleted list' }).nth(1)).toHaveValue('Nested idea');
    await expect(blocks.getByRole('textbox', { name: 'Callout' })).toHaveValue('Remember: sleep before 23:00');
    await blocks.getByRole('checkbox', { name: 'Done' }).first().click();

    await blocks.getByRole('textbox', { name: 'Callout' }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/page');
    await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: 'Page title' }).fill('KNOWLEDGE VAULT');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/LIFE OS\s*\/\s*KNOWLEDGE VAULT/);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(blocks.locator('.nb-page-title')).toHaveText('KNOWLEDGE VAULT');

    await page.getByRole('button', { name: 'Add to Favorites' }).click();
    await expect(sidebar.getByRole('region', { name: 'Favorites' })).toContainText('LIFE OS');
    await page.locator('.notion-page').hover();
    await page.getByRole('button', { name: 'Add cover' }).click();
    await page.getByRole('button', { name: 'orange cover' }).click();
    await page.getByRole('button', { name: 'Add icon' }).click();
    await page.getByRole('button', { name: 'Icon 🚀' }).click();
    await page.mouse.move(0, 0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/notion-page.png' });

    await sidebar.getByRole('tab', { name: 'Files' }).click();
    await expect(page.getByRole('tab', { name: /Claude/ }).first()).toBeVisible();
    await sidebar.getByRole('tab', { name: 'Notion' }).click();
    await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('LIFE OS');

    await page.waitForTimeout(600);
    await app.close();
    ({ app, page } = await launch(userData));
    await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('LIFE OS');
    await expect(page.locator('.notion-blocks').getByRole('textbox', { name: 'Callout' })).toHaveValue('Remember: sleep before 23:00');
    await expect(page.locator('.notion-blocks').getByRole('checkbox', { name: 'Done' }).first()).toHaveAttribute('aria-checked', 'true');
  } finally {
    await app.close();
  }
});
