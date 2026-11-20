import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

interface SavedElement {
  type: string;
  link?: string | null;
  width: number;
  height: number;
}

function savedElements(path: string): SavedElement[] {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { elements: SavedElement[] }).elements;
  } catch {
    return [];
  }
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    (document.activeElement ?? document).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

test('boards: pasted links become embeds and dropped videos play on the board', async () => {
  const { folder, userData } = makeFixture();
  const file = join(folder, 'media.excalidraw');
  writeFileSync(file, JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
  const { app, page } = await launch(userData);
  try {
    await page.getByRole('treeitem', { name: /media\.excalidraw/ }).click();
    const canvas = page.locator('.board-canvas canvas.interactive');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('The board canvas has no size');
    // Excalidraw takes a paste only while the board has focus and the pointer is over the canvas.
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);

    // Any website becomes a live embed, not just Excalidraw's short list.
    await pasteText(page, 'https://example.com/');
    await expect.poll(() => savedElements(file).map((element) => [element.type, element.link])).toEqual([['embeddable', 'https://example.com/']]);
    await expect(page.locator('iframe.excalidraw__embeddable[src="https://example.com/"]')).toHaveCount(1);

    // X posts go through X's embed page instead of a script the app's security policy blocks.
    await pasteText(page, 'https://x.com/someone/status/1859000000000000000');
    await expect(page.locator('iframe[src^="https://platform.twitter.com/embed/Tweet.html?id=1859000000000000000"]')).toHaveCount(1);

    // An Instagram reel link copied from the app plays from Instagram's embed page, not its login wall.
    await pasteText(page, 'https://www.instagram.com/reel/C5d8q0nRlnS/?igsh=abc');
    await expect(page.locator('iframe[src="https://www.instagram.com/reel/C5d8q0nRlnS/embed/"]')).toHaveCount(1);

    // A dropped video is copied into videos/ next to the board and plays in place.
    const bytes = [...readFileSync(join(import.meta.dirname, 'fixtures', 'clip.webm'))];
    await page.evaluate(
      ({ data, x, y }) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array(data)], 'clip.webm', { type: 'video/webm' }));
        const target = document.elementFromPoint(x, y) ?? document.body;
        target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      },
      { data: bytes, x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 },
    );
    await expect.poll(() => readdirSync(join(folder, 'videos')).filter((name) => name.endsWith('.webm')).length, { timeout: 10_000 }).toBe(1);
    await expect.poll(() => savedElements(file).find((element) => element.link?.startsWith('videos/'))?.link).toMatch(/^videos\/media-\d{8}-\d{6}\.webm$/);
    // 320×180 video keeps its shape.
    const video = savedElements(file).find((element) => element.link?.startsWith('videos/'));
    expect(video && Math.round((video.width / video.height) * 100)).toBe(178);
    const player = page.locator('video.board-video');
    await expect(player).toHaveCount(1);
    await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board-media.png' });
  } finally {
    await app.close();
  }
});
