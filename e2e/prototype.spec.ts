import { expect, test, type Page } from '@playwright/test';

async function openSea(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'リセット', exact: true })).toBeEnabled();
  if (await page.getByRole('dialog', { name: 'ポーズ中' }).isVisible()) {
    await page.getByRole('button', { name: '泳ぎを再開 →' }).click();
  }
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('switch', { name: '敵との戦闘', exact: true }).click();
}

const position = (page: Page) => page.locator('.field-bottom > span').first();

test('swim, switch shots, remove targets, pause and recover from focus loss', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openSea(page);
  const initial = await position(page).innerText();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowRight');
  await expect(position(page)).not.toHaveText(initial);

  await page.keyboard.down('Shift');
  await expect(page.getByRole('heading', { name: 'HOMING', exact: true })).toBeVisible();
  await page.keyboard.down('z');
  await page.waitForTimeout(800);
  await page.keyboard.up('z');
  await page.keyboard.up('Shift');
  await expect(page.getByRole('heading', { name: 'STRAIGHT', exact: true })).toBeVisible();
  await expect(page.locator('.telemetry')).not.toContainText('SHOTS FIRED 0000');

  const targets = page.getByRole('switch', { name: 'ターゲットを表示', exact: true });
  await targets.click();
  await expect(targets).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('switch', { name: 'ターゲットを動かす' })).toBeDisabled();
  await page.keyboard.down('Shift');
  await page.keyboard.down('Space');
  await page.waitForTimeout(450);
  await page.keyboard.up('Space');
  await page.keyboard.up('Shift');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  const frozenPosition = await position(page).innerText();
  const frozenTime = await page.locator('.time-number').innerText();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1100);
  await page.keyboard.up('ArrowLeft');
  expect(await position(page).innerText()).toBe(frozenPosition);
  expect(await page.locator('.time-number').innerText()).toBe(frozenTime);
  await page.keyboard.press('Escape');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const stoppedPosition = await position(page).innerText();
  await page.waitForTimeout(350);
  expect(await position(page).innerText()).toBe(stoppedPosition);
  await page.keyboard.up('ArrowRight');

  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(position(page)).toContainText('X 360');
  await expect(position(page)).toContainText('Y 550');
  await expect(page.locator('.telemetry')).toContainText('SHOTS FIRED 0000');
  await expect(targets).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: 'artifacts/blue-current-desktop.png' });
  expect(errors).toEqual([]);
});

test('preserves the 16:9 board and square field at different browser sizes', async ({ page }) => {
  await openSea(page);
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 700 }, { width: 800, height: 500 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const board = await page.locator('.game-board').boundingBox();
    const field = await page.locator('.play-field').boundingBox();
    const panel = await page.locator('.left-panel').boundingBox();
    expect(board).not.toBeNull();
    expect(field).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(board!.width / board!.height).toBeCloseTo(16 / 9, 3);
    expect(field!.width / field!.height).toBeCloseTo(1, 3);
    expect(panel!.width / field!.width).toBeCloseTo(280 / 720, 3);
    expect(board!.x).toBeGreaterThanOrEqual(0);
    expect(board!.y + board!.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.screenshot({ path: 'artifacts/blue-current-compact.png' });
});
