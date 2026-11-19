import { expect, test, type Locator } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, makeFixture, menu } from './helpers';

const width = (panel: Locator) => panel.evaluate((element) => element.getBoundingClientRect().width);
const onScreen = (panel: Locator) =>
  panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.right > 0 && box.left < window.innerWidth && getComputedStyle(element).opacity === '1';
  });

test('the menu sits left and the open feature on the right; each hides with its button and peeks out on hover', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    const left = page.locator('.dock-corner .dv-tabs-and-actions-container');
    const right = page.locator('.dock-corner-right .dv-tabs-and-actions-container');
    await expect(page.locator('.dv-tabs-and-actions-container').first()).toHaveCSS('height', '36px');
    const names = await menu(page).getByRole('tab').allTextContents();
    expect(names.slice(0, 5)).toEqual(['Workspace', 'To-do', 'Boards', 'Database', 'Calendar']);
    expect(names.at(-1)).toBe('Settings');
    const menuBox = await menu(page).boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(menuBox!.x).toBe(0);
    expect(sidebarBox!.x).toBeGreaterThan(menuBox!.x + menuBox!.width);
    await expect(sidebar.getByRole('treeitem', { name: /hello\.md/ })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/layout-open.png' });

    // Menu: button and ⌘\.
    await page.getByRole('button', { name: 'Hide menu' }).click();
    await expect.poll(() => onScreen(menu(page))).toBe(false);
    await expect(left).toHaveCSS('padding-left', '112px');
    await page.keyboard.press('Meta+Backslash');
    await expect.poll(() => onScreen(menu(page))).toBe(true);
    await expect(left).toHaveCSS('padding-left', '0px');

    // Sidebar: button; then hovering the right edge slides it out over the page, leaving slides it back.
    await page.getByRole('button', { name: 'Hide sidebar' }).click();
    await expect.poll(() => onScreen(sidebar)).toBe(false);
    await expect(right).toHaveCSS('padding-right', '44px');
    const viewport = page.viewportSize() ?? (await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })));
    await page.mouse.move(viewport.width - 3, viewport.height / 2);
    await expect.poll(() => onScreen(sidebar)).toBe(true);
    await expect(sidebar.getByRole('treeitem', { name: /hello\.md/ })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/layout-sidebar-peek.png' });
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await expect.poll(() => onScreen(sidebar)).toBe(false);

    // Same for the menu on the left edge; picking a feature from the peek works.
    await page.getByRole('button', { name: 'Hide menu' }).click();
    await page.mouse.move(3, viewport.height / 2);
    await expect.poll(() => onScreen(menu(page))).toBe(true);
    await page.screenshot({ animations: 'disabled', path: 'test-results/layout-menu-peek.png' });

    await page.waitForTimeout(800);
    await app.close();
    ({ app, page } = await launch(userData));
    await expect(page.getByRole('button', { name: 'Show menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible();
    expect(await width(page.getByRole('complementary', { name: 'Sidebar' }))).toBeGreaterThan(100);
  } finally {
    await app.close();
  }
});

test('the panel buttons come after every draggable area on every page, so the window never swallows their clicks', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    // Electron applies drag areas in page order: one placed after a button covers it in the real window (tests can't see that).
    const buttonsLast = () =>
      page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.panel-toggle')];
        const draggable = [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region') === 'drag');
        return buttons.length === 2 && draggable.every((area) => buttons.every((button) => area.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING));
      });
    for (const name of ['Workspace', 'To-do', 'Boards', 'Database', 'Calendar', 'Claude', 'Inbox', 'Settings']) {
      await menu(page).getByRole('tab', { name }).click();
      expect(await buttonsLast(), name).toBe(true);
    }
    await page.getByRole('button', { name: 'Hide menu' }).click();
    expect(await buttonsLast()).toBe(true);
    await page.getByRole('button', { name: 'Show menu' }).click();
    await expect(menu(page).getByRole('tab', { name: 'Inbox' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Boards lists every board in the folder; the picked one fills the window; + makes a new one', async () => {
  const { folder, userData } = makeFixture();
  mkdirSync(join(folder, 'plans'));
  writeFileSync(join(folder, 'plans', 'Launch.excalidraw'), '');
  const { app, page } = await launch(userData);
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await menu(page).getByRole('tab', { name: 'Boards' }).click();
    const list = sidebar.getByRole('list', { name: 'Boards' });
    await expect(list.getByRole('button')).toHaveText(['plans/Launch']);
    await list.getByRole('button', { name: 'plans/Launch' }).click();
    await expect(page.locator('main .board-canvas')).toBeVisible();
    await expect(list.getByRole('button', { name: 'plans/Launch' })).toHaveAttribute('aria-current', 'true');
    await sidebar.getByRole('button', { name: 'New board' }).click();
    await expect(list.getByRole('button')).toHaveText(['plans/Launch', 'Untitled board']);
    await expect(list.getByRole('button', { name: 'Untitled board' })).toHaveAttribute('aria-current', 'true');
    await page.screenshot({ animations: 'disabled', path: 'test-results/boards-view.png' });
  } finally {
    await app.close();
  }
});
