import { expect, test } from '@playwright/test';
import { startFakeGoogle } from './fixtures/fake-google';
import { launch, makeFixture, menu } from './helpers';

test('to-do: fills the window from the menu; add, tick off, switch to board, drag between columns, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.locator('main .todo-page');
    await menu(page).getByRole('tab', { name: 'To-do' }).click();
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeHidden();
    const add = sidebar.getByRole('textbox', { name: 'Add a to-do' });
    for (const text of ['Send the email to Adrian', 'Fit the new spiral', 'Ship the old part']) {
      await add.fill(text);
      await add.press('Enter');
    }
    await expect(sidebar.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(3);
    await sidebar.getByRole('checkbox', { name: 'Mark "Send the email to Adrian" as done' }).click();
    await expect(sidebar.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(2);
    await page.screenshot({ animations: 'disabled', path: 'test-results/todo-page.png' });

    await page.getByRole('radio', { name: 'Board' }).click();
    const board = page.locator('.todo-board');
    await expect(board.getByRole('region', { name: 'Done' }).getByRole('listitem')).toHaveCount(1);
    await board.getByRole('listitem', { name: 'Fit the new spiral' }).dragTo(board.getByRole('region', { name: 'In progress' }));
    await expect(board.getByRole('region', { name: 'In progress' }).getByRole('listitem')).toHaveText(['Fit the new spiral']);
    await page.screenshot({ animations: 'disabled', path: 'test-results/todo-board.png' });

    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('.todo-page .todo-tag')).toHaveText(['In progress']);
    await page.screenshot({ animations: 'disabled', path: 'test-results/todo-list.png' });

    await app.close();
    ({ app, page } = await launch(userData));
    await menu(page).getByRole('tab', { name: 'To-do' }).click();
    await expect(page.locator('main .todo-page').getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(2);
  } finally {
    await app.close();
  }
});

test('calendar: set up Google, sign in, see events in their colors, hide a calendar, and add an event', async () => {
  const google = await startFakeGoogle();
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await menu(page).getByRole('tab', { name: 'Calendar' }).click();
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-setup.png' });
    await sidebar.getByRole('textbox', { name: 'Client ID' }).fill('not-a-client-id');
    await sidebar.getByRole('textbox', { name: 'Client secret' }).fill('secret');
    await sidebar.getByRole('button', { name: 'Save' }).click();
    await expect(sidebar.getByRole('alert')).toContainText('ends in .apps.googleusercontent.com');

    await sidebar.getByRole('textbox', { name: 'Client ID' }).fill('123-test.apps.googleusercontent.com');
    await sidebar.getByRole('textbox', { name: 'Client secret' }).fill('test-secret');
    await sidebar.getByRole('button', { name: 'Save' }).click();
    await sidebar.getByRole('button', { name: 'Sign in with Google' }).click();
    const agenda = sidebar.getByLabel('Upcoming events');
    await expect(agenda.getByText('Call with the garage')).toBeVisible();
    await expect(agenda.getByText("Mum's birthday")).toHaveCount(0);

    await sidebar.getByRole('button', { name: 'Calendars and accounts' }).click();
    await sidebar.getByRole('checkbox', { name: 'Family' }).check();
    await expect(agenda.getByText("Mum's birthday")).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-list.png' });
    await sidebar.getByRole('button', { name: 'Calendars and accounts' }).click();

    await sidebar.getByRole('button', { name: 'New event' }).click();
    const form = sidebar.getByRole('form', { name: 'New event' });
    await form.getByRole('textbox', { name: 'Event name' }).fill('Fit the new spiral');
    await form.getByRole('checkbox', { name: 'All day' }).check();
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-new-event.png' });
    await form.getByRole('button', { name: 'Add event' }).click();
    await expect(agenda.getByText('Fit the new spiral')).toBeVisible();
    expect(google.created).toHaveLength(1);
    expect(google.created[0]).toMatchObject({ summary: 'Fit the new spiral' });
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-agenda.png' });
  } finally {
    await app.close();
    google.close();
  }
});

test('calendar: a sign-in Google never finishes shows Waiting for Google, and Cancel gets out of it', async () => {
  const google = await startFakeGoogle({ blockSignIn: true });
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_GOOGLE_TEST_BASE: google.base });
  try {
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await menu(page).getByRole('tab', { name: 'Calendar' }).click();
    await sidebar.getByRole('textbox', { name: 'Client ID' }).fill('123-test.apps.googleusercontent.com');
    await sidebar.getByRole('textbox', { name: 'Client secret' }).fill('test-secret');
    await sidebar.getByRole('button', { name: 'Save' }).click();
    await sidebar.getByRole('button', { name: 'Sign in with Google' }).click();
    await expect(sidebar.getByText('Waiting for Google…')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-waiting.png' });
    await sidebar.getByRole('button', { name: 'Cancel' }).click();
    await expect(sidebar.getByRole('alert')).toHaveText('Sign-in cancelled.');
    await expect(sidebar.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  } finally {
    await app.close();
    google.close();
  }
});
