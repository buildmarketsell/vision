import { expect, test } from '@playwright/test';
import { launch, makeFixture } from './helpers';

test('file search: the magnifier in the Files header finds files and folders by name; ⌘P opens it', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await sidebar.getByRole('button', { name: /Search files/ }).click();
    const box = sidebar.getByRole('textbox', { name: 'Search files and folders' });
    await expect(box).toBeFocused();

    // A file deep in a folder, with where it lives; Enter opens it and the search stays.
    await box.fill('IDEA');
    const results = sidebar.getByRole('listbox', { name: 'Search results' });
    await expect(results.getByRole('option', { name: /idea\.txt/ })).toContainText('notes');
    await expect(sidebar.getByRole('tree', { name: 'Files' })).toBeHidden();
    await page.screenshot({ animations: 'disabled', path: 'test-results/file-search.png' });
    await box.press('Enter');
    await expect(page.locator('.dv-tab', { hasText: /^idea\.txt$/ })).toHaveCount(1, { timeout: 15_000 });

    await box.fill('nothing-like-this');
    await expect(results).toContainText('Nothing called');

    // A folder unfolds in the tree and the search closes.
    await box.fill('note');
    await results.getByRole('option', { name: /^notes/ }).click();
    await expect(box).toBeHidden();
    await expect(page.getByRole('treeitem', { name: /^notes/ })).toHaveAttribute('aria-selected', 'true');

    // ⌘P brings it back, focused; Escape clears, then closes.
    await page.keyboard.press('Meta+p');
    await expect(box).toBeFocused();
    await box.fill('hello');
    await box.press('Escape');
    await expect(box).toHaveValue('');
    await box.press('Escape');
    await expect(box).toBeHidden();
  } finally {
    await app.close();
  }
});
