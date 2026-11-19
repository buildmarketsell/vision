import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, makeFixture } from './helpers';

test('to-do: add, tick off, open as a board, drag between columns, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    const sidebar = page.locator('aside');
    await sidebar.getByRole('tab', { name: 'To-do' }).click();
    const add = sidebar.getByRole('textbox', { name: 'Add a to-do' });
    for (const text of ['Send the email to Adrian', 'Fit the new spiral', 'Ship the old part']) {
      await add.fill(text);
      await add.press('Enter');
    }
    await expect(sidebar.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(3);
    await sidebar.getByRole('checkbox', { name: 'Mark "Send the email to Adrian" as done' }).click();
    await expect(sidebar.getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(2);
    await page.screenshot({ animations: 'disabled', path: 'test-results/todo-sidebar.png' });

    await sidebar.getByRole('button', { name: 'Open as a board' }).click();
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
    await page.locator('aside').getByRole('tab', { name: 'To-do' }).click();
    await expect(page.locator('aside').getByRole('list', { name: 'To-dos' }).getByRole('listitem')).toHaveCount(2);
  } finally {
    await app.close();
  }
});

/** A calendar file with events relative to now, so the agenda always has a Today and a Tomorrow. */
function calendarFixture(): string {
  const stamp = (offsetHours: number) => {
    const date = new Date(Date.now() + offsetHours * 60 * 60_000);
    date.setMinutes(0, 0, 0);
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:a@test', `DTSTART:${stamp(2)}`, `DTEND:${stamp(3)}`, 'SUMMARY:Call with the garage', 'LOCATION:Technowagen', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:b@test', `DTSTART:${stamp(26)}`, `DTEND:${stamp(27)}`, 'SUMMARY:Weekly Plan', 'RRULE:FREQ=WEEKLY;COUNT=3', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const path = join(mkdtempSync(join(tmpdir(), 'vision-calendar-')), 'basic.ics');
  writeFileSync(path, ics);
  return path;
}

test('calendar: asks for the private link, rejects a bad one, then shows what is coming up', async () => {
  const { userData } = makeFixture();
  const { app, page } = await launch(userData, undefined, { VISION_CALENDAR_FIXTURE: calendarFixture() });
  try {
    const sidebar = page.locator('aside');
    await sidebar.getByRole('tab', { name: 'Calendar' }).click();
    const link = sidebar.getByRole('textbox', { name: 'Secret address in iCal format' });
    await expect(link).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-connect.png' });

    await link.fill('http://not-secure.example.com/basic.ics');
    await sidebar.getByRole('button', { name: 'Connect' }).click();
    await expect(sidebar.getByRole('alert')).toHaveText('Paste the full link, starting with https://');

    await link.fill('https://calendar.google.com/calendar/ical/test/private-abc/basic.ics');
    await sidebar.getByRole('button', { name: 'Connect' }).click();
    const agenda = sidebar.getByLabel('Upcoming events');
    await expect(agenda.getByText('Call with the garage')).toBeVisible();
    await expect(agenda.getByText('Weekly Plan')).toHaveCount(2);
    await page.screenshot({ animations: 'disabled', path: 'test-results/calendar-agenda.png' });
  } finally {
    await app.close();
  }
});
