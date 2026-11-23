import { expect, test } from '@playwright/test';
import { launch, makeFixture, menu } from './helpers';

test('agents: make one, chat, approve from Waiting on you, change trust, run a routine, fresh chat', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData);
  try {
    await menu(page).getByRole('tab', { name: 'Agents' }).click();
    const column = page.getByRole('navigation', { name: 'Agents' });
    await expect(page.getByText('Make your first agent')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-empty.png' });

    // New agent: name, job; the folder defaults to the open one.
    await page.getByRole('button', { name: 'New agent' }).last().click();
    const sheet = page.getByRole('dialog', { name: 'New agent' });
    await sheet.getByRole('textbox', { name: 'Name' }).fill('Scout');
    await sheet.getByRole('textbox', { name: 'Job' }).fill('Keeps the store tidy.');
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-creator.png' });
    await sheet.getByRole('button', { name: 'Create agent' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText('Scout is ready')).toBeVisible();
    await expect(column.getByRole('button', { name: /Scout/ })).toHaveAttribute('aria-current', 'page');

    // Chat: the reply comes under Scout's name.
    const box = page.getByRole('textbox', { name: 'Message Scout' });
    await box.fill('hello there');
    await box.press('Enter');
    await expect(page.locator('.agent-bubble', { hasText: 'hello there' })).toBeVisible();
    await expect(page.getByText('Hello from fake Claude. You said: hello there')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.agent-reply-name').first()).toHaveText('Scout');

    // An edit asks first: the approval shows in the chat and in Waiting on you, answerable there.
    await box.fill('please edit the notes');
    await box.press('Enter');
    await expect(page.getByRole('alertdialog', { name: 'Scout wants to change a file' })).toBeVisible({ timeout: 15_000 });
    await expect(column.getByRole('button', { name: /Waiting on you/ })).toContainText('1');
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-approval.png' });
    await column.getByRole('button', { name: /Waiting on you/ }).click();
    await page.getByRole('alertdialog', { name: 'Scout wants to change a file' }).getByRole('button', { name: 'Allow' }).click();
    await expect(page.getByText('Nothing needs you.')).toBeVisible({ timeout: 15_000 });
    await column.getByRole('button', { name: /Scout/ }).click();
    await expect(page.getByText('I wrote notes.txt.')).toBeVisible({ timeout: 15_000 });

    // Details: trust level and face.
    await page.getByRole('button', { name: 'Details' }).click();
    const details = page.getByRole('complementary', { name: 'Scout details' });
    await details.getByRole('radio', { name: /Ask me everything/ }).click();
    await expect(details.getByRole('radio', { name: /Ask me everything/ })).toHaveAttribute('aria-checked', 'true');
    await details.getByRole('radio', { name: 'ghost' }).click();
    await expect(details.getByRole('radio', { name: 'ghost' })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-details.png' });
    await details.getByRole('button', { name: 'Close details' }).click();

    // A routine, run now: its message lands in Scout's chat.
    await column.getByRole('button', { name: 'Routines' }).click();
    await page.getByRole('button', { name: 'New routine' }).click();
    await page.getByRole('textbox', { name: 'What to tell it' }).fill('daily check');
    await page.getByRole('button', { name: 'Add routine' }).click();
    await expect(page.getByText('Scout · Weekdays at 09:00')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-routines.png' });
    await page.getByRole('button', { name: 'Run now' }).click();
    await expect(page.getByText(/last ran/)).toBeVisible();
    await column.getByRole('button', { name: /Scout/ }).click();
    await expect(page.getByText('You said: Routine: daily check')).toBeVisible({ timeout: 15_000 });

    // Fresh chat: Scout writes its note, the chat starts over and the note is kept.
    await page.getByRole('button', { name: 'Details' }).click();
    await details.getByRole('button', { name: 'Fresh chat' }).click();
    await expect(page.getByText(/Fresh chat\. Scout kept a handoff note/)).toBeVisible({ timeout: 15_000 });
    await expect(details.locator('.agent-note')).toContainText('Hello from fake Claude');
    await expect(page.locator('.agent-bubble')).toHaveCount(0);
    await page.screenshot({ animations: 'disabled', path: 'test-results/agents-fresh-chat.png' });

    // ⌘K finds agents.
    await page.keyboard.press('Meta+k');
    await page.keyboard.type('Scout');
    await expect(page.getByRole('option', { name: /Scout/ }).first()).toBeVisible();
  } finally {
    await app.close();
  }
});
