import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { macFontId } from '../../src/features/board/boardFonts';
import { launch, makeFixture } from './helpers';

interface SavedText {
  type: string;
  fontSize: number;
  fontFamily: number;
  strokeColor: string;
  height: number;
}

function savedText(path: string): SavedText | undefined {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { elements: SavedText[] }).elements.find((element) => element.type === 'text');
  } catch {
    return undefined;
  }
}

test('boards: text in any Mac font, at any size, in any color', async () => {
  const { folder, userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('button', { name: 'New Board' }).click();
    const canvas = page.locator('.board-canvas canvas.interactive');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('The board canvas has no size');

    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.keyboard.type('Hello');
    await page.keyboard.press('Escape');
    const file = join(folder, 'Untitled board.excalidraw');
    await expect.poll(() => savedText(file)?.fontSize).toBe(20);

    // Every font on the Mac is listed, searchable, and drawn in itself.
    await page.getByRole('button', { name: 'Font', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search fonts' }).fill('georgia');
    await expect(page.getByRole('listbox', { name: 'Fonts' }).getByRole('option').first()).toHaveText('Georgia');
    await page.screenshot({ animations: 'disabled', path: 'test-results/board-fonts.png' });
    await page.keyboard.press('Enter');
    await expect.poll(() => savedText(file)?.fontFamily).toBe(macFontId('Georgia'));

    const size = page.getByRole('spinbutton', { name: 'Text size in pixels' });
    await size.fill('57');
    await size.press('Enter');
    await expect.poll(() => savedText(file)?.fontSize).toBe(57);
    await size.fill('0');
    await size.press('Enter');
    await expect(size).toHaveValue('57');

    // VISION's own picker: dragging the square previews and saves on release; a typed hex saves on Enter.
    await page.getByRole('button', { name: /Custom color/ }).click();
    const area = page.getByRole('slider', { name: 'Saturation and brightness' });
    const areaBox = await area.boundingBox();
    if (!areaBox) throw new Error('The color square has no size');
    await page.mouse.move(areaBox.x + areaBox.width * 0.2, areaBox.y + areaBox.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(areaBox.x + areaBox.width - 2, areaBox.y + 2, { steps: 4 });
    await page.screenshot({ path: 'test-results/board-color-picker.png' });
    await page.mouse.up();
    await expect.poll(() => savedText(file)?.strokeColor).toMatch(/^#f[0-9a-f]{5}$/);
    const hex = page.getByLabel('Hex color');
    await hex.fill('12ab9f');
    await hex.press('Enter');
    await expect.poll(() => savedText(file)?.strokeColor).toBe('#12ab9f');
    await hex.fill('nope');
    await hex.press('Enter');
    await expect(hex).toHaveValue('12AB9F');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Color picker' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Font', exact: true })).toHaveText('Georgia');
    // The text's box grows with it, so nothing is cut off.
    await expect.poll(() => savedText(file)?.height ?? 0).toBeGreaterThan(57);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board-text.png' });
  } finally {
    await app.close();
  }
});
