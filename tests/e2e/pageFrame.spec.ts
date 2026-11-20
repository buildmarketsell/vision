import { expect, test, type Page } from '@playwright/test';
import { launch, makeFixture, menu } from './helpers';

/**
 * Every page that fills the window sits in the shared page frame (styles.css): a centered column,
 * the title at the column's text edge, and boards starting where the title starts.
 * Before this, To-do's board was pinned 24px from the window's left edge with the menu hidden (Dan, 2026-11-20).
 */
async function frame(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main:has(.page-title)') ?? document.body;
    const title = document.querySelector('main .page-title');
    const column = title?.closest('.page-column');
    const firstBoardColumn = document.querySelector('main .page-wide > *');
    const box = (element: Element | null | undefined) => element?.getBoundingClientRect() ?? null;
    const area = main.getBoundingClientRect();
    return { area: { left: area.left, right: area.right }, title: box(title), column: box(column), board: box(firstBoardColumn) };
  });
}

/** Opens a menu page, then leaves the menu open or hidden. */
async function openPage(page: Page, name: string, menuOpen: boolean) {
  const setMenu = async (open: boolean) => {
    const button = page.getByRole('button', { name: open ? 'Show menu' : 'Hide menu' });
    if (await button.count()) await button.click();
  };
  await setMenu(true);
  await menu(page).getByRole('tab', { name }).click();
  await setMenu(menuOpen);
  await expect(page.locator('main .page-title')).toBeVisible();
  // The menu slides: measure once the page area has stopped moving.
  let last = NaN;
  await expect.poll(async () => {
    const { area } = await frame(page);
    const settled = area.left === last;
    last = area.left;
    return settled;
  }, { intervals: [50] }).toBe(true);
}

test('page frame: To-do, Content, Settings and the Boards home are centered with the title at the same inset, menu open or hidden', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    for (const width of [1440, 900]) {
      await page.setViewportSize({ width, height: 900 });
      for (const menuOpen of [true, false]) {
        const state = `${width}px, menu ${menuOpen ? 'open' : 'hidden'}`;
        for (const name of ['To-do', 'Content', 'Settings', 'Boards']) {
          await openPage(page, name, menuOpen);
          const { area, title, column } = await frame(page);
          expect(column, `${name}, ${state}: the title must be a .page-title inside a .page-column`).not.toBeNull();
          const leftGap = (column?.left ?? 0) - area.left;
          const rightGap = area.right - (column?.right ?? 0);
          expect(Math.abs(leftGap - rightGap), `${name}, ${state}: the column must be centered`).toBeLessThanOrEqual(1);
          expect((title?.left ?? 0) - area.left, `${name}, ${state}: the title must keep at least 24px from the edge`).toBeGreaterThanOrEqual(24);
        }
        await openPage(page, 'To-do', menuOpen);
        await page.getByRole('radio', { name: 'Board' }).click();
        const { title, board } = await frame(page);
        expect(Math.abs((board?.left ?? 0) - (title?.left ?? -99)), `To-do board, ${state}: the board must start under the title`).toBeLessThanOrEqual(1);
        await page.screenshot({ animations: 'disabled', path: `test-results/page-frame-todo-board-${width}-${menuOpen ? 'menu' : 'nomenu'}.png` });
        await page.getByRole('radio', { name: 'List' }).click();
      }
    }
  } finally {
    await app.close();
  }
});
