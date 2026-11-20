import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startFakeSocial } from './fixtures/fake-social';
import { launch, makeFixture, menu } from './helpers';

const daysAgo = (days: number) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

test('content: Content in the menu shows the dashboard; connect YouTube and Instagram, see followers, views, growth and latest posts', async () => {
  const social = await startFakeSocial();
  const { userData } = makeFixture();
  // Earlier daily readings (no keys: those need the Keychain), so the growth line has something to draw.
  writeFileSync(
    join(userData, 'content.json'),
    JSON.stringify({ youtube: null, instagram: null, history: { youtube: [{ day: daysAgo(6), followers: 12100, totalViews: 800000 }, { day: daysAgo(3), followers: 12250, totalViews: 815000 }], instagram: [] } }),
  );
  const { app, page } = await launch(userData, undefined, { VISION_CONTENT_TEST_BASE: social.base });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await menu(page).getByRole('tab', { name: 'Content' }).click();
    const content = page.locator('main .content-page');
    await expect(content.getByRole('heading', { name: 'Content' })).toBeVisible();
    await expect(content.getByRole('form', { name: 'Connect YouTube' })).toBeVisible();
    await expect(content.getByRole('form', { name: 'Connect Instagram' })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/content-empty.png' });

    // A wrong key is refused with a message, and nothing is saved.
    const youtube = content.getByRole('region', { name: 'YouTube' });
    await youtube.getByRole('textbox', { name: 'YouTube channel' }).fill('@dan');
    await youtube.getByLabel('YouTube API key').fill('wrong-key');
    await youtube.getByRole('button', { name: 'Connect YouTube' }).click();
    await expect(youtube.getByRole('alert')).toContainText('did not accept the API key');

    await youtube.getByLabel('YouTube API key').fill('good-key');
    await youtube.getByRole('button', { name: 'Connect YouTube' }).click();
    await expect(youtube.locator('.content-tile', { hasText: 'Subscribers' })).toContainText('12.4K');
    await expect(youtube.locator('.content-tile', { hasText: 'Subscribers' })).toContainText('+300 in 7 days');
    await expect(youtube.locator('.content-tile', { hasText: 'Total views' })).toContainText('830K');
    await expect(youtube.locator('.content-post', { hasText: 'How I run my store with AI' })).toContainText('15.3K');
    await expect(youtube.getByRole('img', { name: /Subscribers: from 12,100 to 12,400/ })).toBeVisible();

    const instagram = content.getByRole('region', { name: 'Instagram' });
    await instagram.getByLabel('Instagram access token').fill('good-token');
    await instagram.getByRole('button', { name: 'Connect Instagram' }).click();
    await expect(instagram.locator('.content-tile', { hasText: 'Followers' })).toContainText('3.1K');
    await expect(instagram.locator('.content-tile', { hasText: 'Views, 28 days' })).toContainText('52K');
    await expect(instagram.locator('.content-post', { hasText: 'Morning routine' })).toContainText('340');
    await expect(instagram.getByText('The growth line starts tomorrow')).toBeVisible();

    await expect(content.getByLabel('Overview').locator('.content-hero')).toContainText('15.5K');
    await page.screenshot({ animations: 'disabled', path: 'test-results/content-dashboard.png' });
    await content.locator('.content-chart').first().hover();
    await expect(content.locator('.content-chart-tip')).toBeVisible();
    await expect(content.locator('.content-chart-pill')).toBeVisible();
    await youtube.locator('.content-chart').screenshot({ animations: 'disabled', path: 'test-results/content-chart-hover.png' });
    await page.mouse.move(0, 0);
    await youtube.locator('.content-chart-plot').focus();
    await page.keyboard.press('ArrowRight');
    await expect(content.locator('.content-chart-tip')).toContainText('12,100');
    await youtube.getByRole('radio', { name: 'Views' }).click();
    await expect(youtube.getByRole('img', { name: /Views: from 800,000 to/ })).toBeVisible();
    await expect(youtube.locator('.content-tile', { hasText: 'Subscribers' }).locator('.content-spark')).toBeVisible();
    await instagram.scrollIntoViewIfNeeded();
    await page.screenshot({ animations: 'disabled', path: 'test-results/content-instagram.png' });
    await page.setViewportSize({ width: 760, height: 900 });
    await content.evaluate((element) => (element.scrollTop = 0));
    await page.screenshot({ animations: 'disabled', path: 'test-results/content-narrow.png' });

    await instagram.getByRole('button', { name: 'Disconnect' }).click();
    await expect(instagram.getByRole('form', { name: 'Connect Instagram' })).toBeVisible();
  } finally {
    await app.close();
    social.close();
  }
});
