import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture, menu } from './helpers';

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

/** The color of the most opaque pixel on the dot canvas, or null when nothing is drawn. */
function strongestDot(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.board-dots');
    if (!canvas?.width || !canvas.height) return null;
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return null;
    let best = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > (data[best + 3] ?? 0)) best = i - 3;
    return data[best + 3] ? `rgb(${data[best]}, ${data[best + 1]}, ${data[best + 2]})` : null;
  });
}

test('boards: FigJam-style tools, styles, sticky notes and undo, all saved to the file', async () => {
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

    // After the note, new shapes keep the color picked before (blue), not the note's dark text.
    await page.getByRole('button', { name: 'Ellipse' }).click();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => savedElements(file).find((element) => element.type === 'ellipse')?.strokeColor).toBe('#4465e9');
    await page.getByRole('button', { name: 'Undo' }).click();

    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => savedElements(file).filter((element) => element.customData?.boardNote).length).toBe(0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board.png' });

    // FigJam's dot grid drawn behind a see-through canvas, in the theme's colors (white page in light, near-black in dark).
    const stage = page.locator('.board-stage');
    await expect.poll(() => strongestDot(page)).toBe('rgb(203, 203, 203)');
    await expect(stage).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Catppuccin Mocha' }).click();
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    await expect(stage).toHaveCSS('background-color', 'rgb(17, 17, 27)');
    await expect.poll(() => strongestDot(page)).toBe('rgb(49, 50, 68)');
    await expect(page.getByRole('button', { name: 'Rectangle' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board-dark.png' });
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
