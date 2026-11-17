import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

interface SavedElement {
  type: string;
  roughness: number;
  strokeColor: string;
  customData?: { boardNote?: boolean };
}

function savedElements(path: string): SavedElement[] {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { elements: SavedElement[] }).elements;
  } catch {
    return [];
  }
}

test('boards: tldraw-style tools, styles, sticky notes and undo, all saved to the file', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('button', { name: 'New Board' }).click();
    await expect(page.getByRole('treeitem', { name: /Untitled board\.excalidraw/ })).toBeVisible({ timeout: 10_000 });
    const canvas = page.locator('.board-canvas canvas.interactive');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error('The board canvas has no size');
    // In a narrow pane the style panel appears once a drawing tool is picked, as in tldraw.
    await expect(page.getByRole('button', { name: 'blue', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Rectangle' }).click();
    await page.getByRole('button', { name: 'blue', exact: true }).click();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 8 });
    await page.mouse.up();

    const file = join(folder, 'Untitled board.excalidraw');
    await expect.poll(() => savedElements(file).map((element) => element.type)).toEqual(['rectangle']);
    expect(savedElements(file)[0]).toMatchObject({ roughness: 0, strokeColor: '#4465e9' });

    await page.getByRole('button', { name: 'Sticky note' }).click();
    await page.keyboard.type('Idea');
    await page.keyboard.press('Escape');
    await expect.poll(() => savedElements(file).filter((element) => element.customData?.boardNote).length).toBe(1);
    await expect.poll(() => savedElements(file).some((element) => element.type === 'text')).toBe(true);

    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => savedElements(file).filter((element) => element.customData?.boardNote).length).toBe(0);
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
