import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture, menu } from './helpers';

/** A tiny real board: one blue rectangle, so its card has a picture. */
const RECTANGLE = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'r1', type: 'rectangle', x: 0, y: 0, width: 200, height: 120, strokeColor: '#4465e9', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, roughness: 0, opacity: 100, angle: 0, seed: 1, version: 1, versionNonce: 1, isDeleted: false, groupIds: [], boundElements: null, link: null, locked: false }],
  appState: {},
  files: {},
});

test('Boards home: recents with previews, folders, rename, move, and back from a board', async () => {
  const { folder, userData } = makeFixture();
  mkdirSync(join(folder, 'plans'));
  writeFileSync(join(folder, 'plans', 'Launch.excalidraw'), RECTANGLE);
  writeFileSync(join(folder, 'Ideas.excalidraw'), RECTANGLE);
  // Launch was edited last, so it comes first in Recents.
  utimesSync(join(folder, 'Ideas.excalidraw'), new Date('2026-01-01'), new Date('2026-01-01'));
  const { app, page } = await launch(userData);
  try {
    await page.setViewportSize({ width: 1500, height: 950 });
    await menu(page).getByRole('tab', { name: 'Boards' }).click();
    const main = page.locator('main');
    const recents = main.getByRole('list', { name: 'Recent boards' });
    await expect(recents.getByRole('listitem')).toHaveCount(2);
    await expect(recents.locator('.board-card-name')).toHaveText(['Launch', 'Ideas']);
    await expect(recents.locator('.board-card-detail').first()).toHaveText(/^Edited /);
    // Each card shows a picture of its board.
    await expect(recents.locator('.board-card-preview img')).toHaveCount(2, { timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/boards-home.png' });

    // The sidebar lists the folders that hold boards.
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(sidebar.getByRole('navigation', { name: 'Boards' }).getByRole('button', { name: 'plans' })).toBeVisible();

    // Folders: make one, name it, move Ideas into it through the card's menu.
    await main.getByRole('radio', { name: 'Folders' }).click();
    await main.getByRole('button', { name: 'New folder' }).click();
    const nameField = main.getByRole('textbox', { name: 'Name' });
    await nameField.fill('Reels');
    await nameField.press('Enter');
    await expect.poll(() => existsSync(join(folder, 'Reels'))).toBe(true);
    await main.getByRole('button', { name: 'More for Ideas' }).click();
    await page.getByRole('menuitem', { name: 'Move to…' }).click();
    await page.getByRole('menuitem', { name: 'Reels' }).click();
    await expect.poll(() => existsSync(join(folder, 'Reels', 'Ideas.excalidraw'))).toBe(true);
    await expect(main.locator('.board-card-name')).toHaveText(['plans', 'Reels']);
    await expect(main.locator('.board-card-detail')).toHaveText(['1 board', '1 board']);
    await expect(sidebar.getByRole('navigation', { name: 'Boards' }).getByRole('button', { name: 'Reels' })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/boards-folders.png' });

    // Into the folder, open the board, and back to the home from the board's menu.
    await main.getByRole('button', { name: 'Open Reels' }).click();
    await expect(main.getByRole('heading', { name: 'Reels' })).toBeVisible();
    await main.getByRole('button', { name: 'Open Ideas' }).click();
    await expect(page.locator('main .board-canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ animations: 'disabled', path: 'test-results/board-open.png' });
    await page.getByRole('button', { name: 'Board menu' }).click();
    await page.getByRole('menuitem', { name: 'All boards' }).click();
    await expect(main.getByRole('heading', { name: 'Reels' })).toBeVisible();

    // A new board made here lands in this folder and opens.
    await main.getByRole('button', { name: 'New board' }).click();
    await expect(page.locator('main .board-canvas')).toBeVisible();
    await expect.poll(() => existsSync(join(folder, 'Reels', 'Untitled board.excalidraw'))).toBe(true);
  } finally {
    await app.close();
  }
});
