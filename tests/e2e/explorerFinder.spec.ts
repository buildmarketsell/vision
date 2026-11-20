import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

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
  } finally {
    await app.close();
  }
});
