import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

const DOT_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('⌘-click picks several files to drag out together, and right-click reveals a file in Finder', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    // Record instead of really dragging or opening Finder: nothing may pop up on Dan's screen.
    await app.evaluate(({ shell, webContents }) => {
      const record = globalThis as unknown as { revealed: string[]; dragged: string[][] };
      record.revealed = [];
      record.dragged = [];
      shell.showItemInFolder = (path: string) => void record.revealed.push(path);
      for (const contents of webContents.getAllWebContents()) contents.startDrag = (item) => void record.dragged.push(item.files ?? [item.file]);
    });
    const read = () => app.evaluate(() => globalThis as unknown as { revealed: string[]; dragged: string[][] });

    const hello = page.getByRole('treeitem', { name: /hello\.md/ });
    const notes = page.getByRole('treeitem', { name: /^notes/ });
    await hello.click();
    await notes.click({ modifiers: ['Meta'] });
    await expect(hello).toHaveAttribute('aria-selected', 'true');
    await expect(notes).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ animations: 'disabled', path: 'test-results/explorer-multi-select.png' });

    await notes.dispatchEvent('dragstart');
    await expect.poll(async () => (await read()).dragged).toEqual([[join(folder, 'hello.md'), join(folder, 'notes')]]);

    // A plain click goes back to one file.
    await hello.click();
    await expect(notes).toHaveAttribute('aria-selected', 'false');

    await hello.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Reveal in Finder' }).click();
    await expect.poll(async () => (await read()).revealed).toEqual([join(folder, 'hello.md')]);

    // Dragging the picture in an image tab drags the file itself, so Google Docs and Finder take it.
    writeFileSync(join(folder, 'dot.png'), Buffer.from(DOT_PNG, 'base64'));
    await page.getByRole('button', { name: 'Refresh' }).click();
    await page.getByRole('treeitem', { name: /dot\.png/ }).click();
    const picture = page.locator('.image-view img');
    await expect(picture).toBeVisible({ timeout: 15_000 });
    await picture.dispatchEvent('dragstart');
    await expect.poll(async () => (await read()).dragged.at(-1)).toEqual([join(folder, 'dot.png')]);
  } finally {
    await app.close();
  }
});
