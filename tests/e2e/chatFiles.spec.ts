import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

const DOT_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('a refused tool says why on its row; files, images and folders named in the chat open', async () => {
  const { folder, userData } = makeFixture();
  writeFileSync(join(folder, 'notes', 'dot.png'), Buffer.from(DOT_PNG, 'base64'));
  const { app, page } = await launch(userData);
  try {
    const box = page.getByRole('textbox', { name: 'Message Claude' }).first();
    await expect(box).toBeEnabled({ timeout: 15_000 });
    await box.fill('try the blocked thing');
    await box.press('Enter');

    // The refusal lives on the tool's own row, not in a big banner.
    await expect(page.getByText('Blocked by auto mode: Undermining Oversight')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.notice')).toHaveCount(0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-blocked-tool.png' });

    // The full message is one click away.
    await page.getByText('Ran Serve the block locally for screenshots').click();
    await expect(page.locator('.code-block', { hasText: 'auto mode classifier' })).toBeVisible();

    // The file name in "Read idea.txt" opens the file.
    await page.locator('.tool-row').getByRole('button', { name: 'idea.txt' }).click();
    await expect(page.locator('.dv-tab', { hasText: /^idea\.txt$/ })).toHaveCount(1, { timeout: 15_000 });

    // A path Claude wrote as `code` opens too; a missing one says so instead of doing nothing.
    const reply = page.locator('.assistant-text').last();
    await reply.getByRole('button', { name: 'hello.md' }).click();
    await expect(page.locator('.markdown-document h1')).toHaveText('Hello', { timeout: 15_000 });
    await reply.getByRole('button', { name: 'gone.html' }).click();
    await expect(reply.locator('code[data-missing]')).toHaveAttribute('title', 'Not found in this folder');
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-file-mentions.png' });

    // An image opens as a picture, not "can't be shown as text".
    await reply.getByRole('button', { name: 'dot.png' }).click();
    const picture = page.locator('.image-view img');
    await expect(picture).toBeVisible({ timeout: 15_000 });
    expect(await picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);

    // A folder shows in the files panel, unfolded and selected, even when another panel tab was open.
    await page.getByRole('tab', { name: 'Claude', exact: true }).click();
    await reply.getByRole('button', { name: 'notes/' }).click();
    await expect(page.getByRole('treeitem', { name: /^notes/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('treeitem', { name: /idea\.txt/ })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/chat-folder-reveal.png' });
  } finally {
    await app.close();
  }
});
