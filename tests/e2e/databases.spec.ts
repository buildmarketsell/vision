import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('databases: create one, fill the table, tag, open a page, use the board, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.locator('aside');
    await sidebar.getByRole('tab', { name: 'Notion' }).click();
    await sidebar.getByRole('button', { name: 'New database' }).click();

    const title = page.getByRole('textbox', { name: 'Database name' });
    await title.fill('Content ideas');
    await title.press('Enter');
    await expect(sidebar.getByRole('button', { name: 'Content ideas', exact: true })).toBeVisible();

    const table = page.getByRole('table', { name: 'Content ideas' });
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(4);
    const names = ['Hook about sleep', 'Morning routine reel', 'Behind the scenes'];
    for (const [index, name] of names.entries()) {
      await rows.nth(index + 1).getByRole('button', { name: 'Name: edit' }).click();
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
    }

    await rows.nth(1).getByRole('button', { name: 'Status: edit' }).click();
    await page.getByRole('option', { name: 'In progress' }).click();
    await rows.nth(2).getByRole('button', { name: 'Status: edit' }).click();
    await page.getByRole('option', { name: 'Done' }).click();

    await rows.nth(1).getByRole('button', { name: 'Tags: edit' }).click();
    const search = page.getByRole('textbox', { name: 'Search for an option' });
    await search.fill('Reels');
    await search.press('Enter');
    await search.fill('Spain');
    await search.press('Enter');
    await page.keyboard.press('Escape');
    await expect(rows.nth(1).getByRole('button', { name: 'Tags: edit' }).locator('.db-tag')).toHaveText(['Reels', 'Spain']);

    await page.getByRole('button', { name: 'Add a property' }).click();
    await page.getByRole('menuitemradio', { name: 'Number' }).click();
    await expect(table.getByRole('columnheader', { name: /Number/ })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/database-table.png' });

    await rows.nth(1).hover();
    await rows.nth(1).getByRole('button', { name: 'Open' }).click();
    const peek = page.getByRole('complementary', { name: 'Page' });
    await expect(peek.getByRole('textbox', { name: 'Page title' })).toHaveValue('Hook about sleep');
    await peek.getByRole('textbox', { name: 'Page notes' }).fill('Open with the 3am wake-up story.');
    await page.screenshot({ animations: 'disabled', path: 'test-results/database-peek.png' });
    await peek.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('tab', { name: 'Board' }).click();
    const board = page.locator('.db-board');
    await board.getByText('Behind the scenes').dragTo(board.getByRole('region', { name: 'Not started' }));
    await expect(board.getByRole('region', { name: 'Not started' }).getByRole('listitem')).toHaveText(['Behind the scenes']);
    await page.screenshot({ animations: 'disabled', path: 'test-results/database-board.png' });

    await page.waitForTimeout(600);
    await app.close();
    ({ app, page } = await launch(userData));
    await page.locator('aside').getByRole('tab', { name: 'Notion' }).click();
    await page.locator('aside').getByRole('button', { name: 'Content ideas', exact: true }).click();
    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(page.getByRole('table', { name: 'Content ideas' }).locator('.db-tag')).toContainText(['In progress', 'Reels', 'Spain', 'Done', 'Not started']);
    await page.getByRole('table', { name: 'Content ideas' }).getByRole('row').nth(1).getByRole('button', { name: 'Open' }).click({ force: true });
    await expect(page.getByRole('textbox', { name: 'Page notes' })).toHaveValue('Open with the 3am wake-up story.');
  } finally {
    await app.close();
  }
});
