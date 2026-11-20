import { expect, test } from '@playwright/test';
import { launch, makeFixture, menu } from './helpers';

const readVar = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();

test('settings → colors: pick the accent and the neon around the chat box, turn the neon off, and keep it after a restart', async () => {
  const { userData } = makeFixture();
  let { app, page } = await launch(userData);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    // Dark theme first, so the neon shows like in Dan's VISION.
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: /Catppuccin/ }).click();
    await page.getByRole('radiogroup', { name: 'Accent' }).getByRole('radio', { name: 'Cyan' }).click();
    await page.getByRole('radiogroup', { name: 'Neon' }).getByRole('radio', { name: 'Pink' }).click();
    expect(await page.evaluate(readVar, '--color-accent')).toBe('#22D3EE');
    expect(await page.evaluate(readVar, '--color-neon')).toBe('#FF4FD8');
    // A light accent gets dark text on its buttons.
    expect(await page.evaluate(readVar, '--color-on-accent')).toBe('#1C1A19');
    await page.screenshot({ animations: 'disabled', path: 'test-results/settings-colors.png' });

    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    const neon = page.locator('.composer .neon').first();
    await expect(neon).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: 'test-results/composer-neon.png' });

    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Neon around the chat box' }).getByRole('radio', { name: 'Off' }).click();
    await menu(page).getByRole('tab', { name: 'Workspace' }).click();
    await expect(neon).toBeHidden();

    await app.close();
    ({ app, page } = await launch(userData));
    await expect.poll(() => page.evaluate(readVar, '--color-accent')).toBe('#22D3EE');
    await expect(page.locator('.composer .neon').first()).toBeHidden();
    await menu(page).getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('radiogroup', { name: 'Accent' }).getByRole('radio', { name: 'Theme' }).click();
    await expect.poll(() => page.evaluate(readVar, '--color-accent')).not.toBe('#22D3EE');
  } finally {
    await app.close();
  }
});
