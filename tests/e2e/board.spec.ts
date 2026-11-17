import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

interface SavedElement {
  type: string;
  roughness: number;
}

function savedElements(path: string): SavedElement[] {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { elements: SavedElement[] }).elements;
  } catch {
    return [];
  }
}

test('boards: New Board opens a canvas, drawing saves to the file with clean lines', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('button', { name: 'New Board' }).click();
    await expect(page.getByRole('treeitem', { name: /Untitled board\.excalidraw/ })).toBeVisible({ timeout: 10_000 });
    const canvas = page.locator('.board-canvas canvas.interactive');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error('The board canvas has no size');
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.8);
    await page.keyboard.press('r');
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 8 });
    await page.mouse.up();

    const file = join(folder, 'Untitled board.excalidraw');
    await expect.poll(() => savedElements(file).map((element) => element.type)).toEqual(['rectangle']);
    expect(savedElements(file)[0]?.roughness).toBe(0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board.png' });
  } finally {
    await app.close();
  }
});

test('boards: a broken board file is shown as an error and never saved over', async () => {
  const { folder, userData } = makeFixture();
  const broken = join(folder, 'broken.excalidraw');
  writeFileSync(broken, '{oops');
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('treeitem', { name: /broken\.excalidraw/ }).click();
    await expect(page.getByText("This board can't be opened.")).toBeVisible({ timeout: 10_000 });
    expect(readFileSync(broken, 'utf8')).toBe('{oops');
  } finally {
    await app.close();
  }
});
