import { expect, test, type Page } from '@playwright/test';

interface VirtualPad {
  connected: boolean;
  axes: number[];
  buttons: { pressed: boolean; value: number; touched: boolean }[];
}

declare global { interface Window { virtualPad: VirtualPad } }

async function installPad(page: Page) {
  await page.addInitScript(() => {
    window.virtualPad = {
      connected: true, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.virtualPad.connected ? [{
      ...window.virtualPad, id: 'Virtual standard controller', index: 0, mapping: 'standard', timestamp: performance.now(),
    }] : [] });
  });
}

async function openWithPad(page: Page, practice = true) {
  await installPad(page);
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'リセット', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '戦闘練習', exact: true }).click();
  if (await page.getByRole('dialog', { name: 'ポーズ中' }).isVisible()) await page.keyboard.press('Escape');
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  if (practice) await page.getByRole('switch', { name: '敵との戦闘', exact: true }).click();
  await page.clock.runFor(120);
  await expect(page.locator('.input-source')).toHaveText('PAD');
  await expect(page.locator('.controller-status')).toContainText('コントローラー接続済み');
}

async function setPad(page: Page, update: { connected?: boolean; axes?: number[]; buttons?: number[] }) {
  await page.evaluate((value) => {
    const pad = window.virtualPad;
    if (value.connected !== undefined) pad.connected = value.connected;
    if (value.axes) pad.axes = value.axes;
    if (value.buttons) pad.buttons.forEach((button, index) => {
      button.pressed = value.buttons!.includes(index);
      button.value = Number(button.pressed);
      button.touched = button.pressed;
    });
  }, update);
}

async function xPosition(page: Page) {
  const text = await page.locator('.field-bottom > span').first().innerText();
  return Number(text.match(/X (\d+)/)?.[1]);
}

test('controller menus navigate, confirm and return without carrying held buttons into play', async ({ page }) => {
  await installPad(page); await page.clock.install(); await page.goto('/');
  await expect(page.getByRole('button', { name: '冒険をはじめる →' })).toBeEnabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100);
  await page.clock.runFor(100);
  await setPad(page, { buttons: [13] }); await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: '戦闘練習', exact: true })).toBeFocused();
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [12] }); await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: '冒険をはじめる →' })).toBeFocused();
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [0] }); await page.clock.runFor(300);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [0] }); await page.clock.runFor(500);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).not.toBeVisible();
  await expect(page.locator('.telemetry')).toContainText('SHOTS FIRED 0000');
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [9] }); await page.clock.runFor(100);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [1] }); await page.clock.runFor(100);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [1] }); await page.clock.runFor(100);
  await expect(page.getByRole('dialog', { name: 'タイトル', exact: true })).toBeVisible();
});

test('controller selects the second stage from the stage selection screen', async ({ page }) => {
  await installPad(page); await page.clock.install(); await page.goto('/');
  await expect(page.getByRole('button', { name: '冒険をはじめる →' })).toBeEnabled();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100);
  await page.clock.runFor(100);
  await setPad(page, { buttons: [0, 4] }); await page.clock.runFor(100);
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await setPad(page, { axes: [0, 1], buttons: [0, 4] }); await page.clock.runFor(100);
  await expect(page.locator('.stage-choice').nth(1)).toBeFocused();
  await setPad(page, { axes: [0, 0], buttons: [4] }); await page.clock.runFor(100);
  await setPad(page, { buttons: [0, 4] }); await page.clock.runFor(100);
  await expect(page.locator('.right-panel')).toContainText('ひかりの浅瀬');
  await expect(page.locator('.telemetry')).toContainText('SHOTS FIRED 0000');
});

test('controller movement, fire, focus and Start work, including while paused', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWithPad(page);
  const start = await xPosition(page);
  await setPad(page, { axes: [1, 0] });
  await page.clock.runFor(500);
  await setPad(page, { axes: [0, 0] });
  await page.clock.runFor(120);
  const moved = await xPosition(page);
  expect(moved - start).toBeGreaterThan(130);
  expect(moved - start).toBeLessThan(170);

  await setPad(page, { axes: [-0.59, 0] });
  await page.clock.runFor(500);
  await setPad(page, { axes: [0, 0] });
  await page.clock.runFor(120);
  expect(moved - await xPosition(page)).toBeGreaterThan(60);
  expect(moved - await xPosition(page)).toBeLessThan(90);

  for (const shoulder of [4, 5]) {
    await setPad(page, { buttons: [0, shoulder] });
    await page.clock.runFor(350);
    await expect(page.getByRole('heading', { name: 'HOMING', exact: true })).toBeVisible();
    await expect(page.locator('.controls-guide')).toContainText('L / R');
    await setPad(page, { buttons: [0] }); await page.clock.runFor(150);
    await expect(page.getByRole('heading', { name: 'STRAIGHT', exact: true })).toBeVisible();
  }
  await expect(page.locator('.telemetry')).not.toContainText('SHOTS FIRED 0000');
  await setPad(page, { buttons: [0] });
  await page.clock.runFor(150);
  await expect(page.getByRole('heading', { name: 'STRAIGHT', exact: true })).toBeVisible();
  await setPad(page, { buttons: [9] });
  await page.clock.runFor(80);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  const time = await page.locator('.time-number').innerText();
  await page.clock.runFor(1500);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  expect(await page.locator('.time-number').innerText()).toBe(time);

  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [0] }); await page.clock.runFor(120);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).not.toBeVisible();
  const shots = await page.locator('.telemetry > span').first().innerText();
  await page.clock.runFor(400);
  expect(await page.locator('.telemetry > span').first().innerText()).toBe(shots);
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await page.screenshot({ path: 'artifacts/blue-current-controller.png' });
  expect(errors).toEqual([]);
});

test('disconnect and loss of focus pause safely without stuck controller input', async ({ page }) => {
  await openWithPad(page);
  await setPad(page, { axes: [1, 0], buttons: [0] }); await page.clock.runFor(200);
  await setPad(page, { connected: false }); await page.clock.runFor(80);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  await expect(page.locator('.input-source')).toHaveText('KEYBOARD');
  await page.keyboard.press('Escape'); await page.clock.runFor(120);
  const stopped = await xPosition(page);
  await page.clock.runFor(300);
  expect(await xPosition(page)).toBe(stopped);

  await setPad(page, { connected: true }); await page.clock.runFor(200);
  expect(await xPosition(page)).toBe(stopped);
  await expect(page.locator('.controller-status')).toContainText('一度離してください');
  await setPad(page, { axes: [0, 0], buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { axes: [-1, 0] }); await page.clock.runFor(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(120);
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  await page.keyboard.press('Escape'); await page.clock.runFor(120);
  const afterBlur = await xPosition(page);
  await page.clock.runFor(200);
  expect(await xPosition(page)).toBe(afterBlur);
});

test('the controller can retry after the defeat animation without firing from the held confirm button', async ({ page }) => {
  test.setTimeout(60000);
  await openWithPad(page, false);
  const over = page.getByRole('dialog', { name: 'ゲームオーバー' });
  for (let i = 0; i < 20 && !await over.isVisible(); i++) await page.clock.runFor(10000);
  await expect(over).toBeVisible();
  await setPad(page, { buttons: [0] }); await page.clock.runFor(120);
  await expect(over).not.toBeVisible();
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 10 / 10');
  await page.clock.runFor(600);
  await expect(page.locator('.telemetry')).toContainText('SHOTS FIRED 0000');
  await setPad(page, { buttons: [] }); await page.clock.runFor(50);
  await setPad(page, { buttons: [0] }); await page.clock.runFor(350);
  await expect(page.locator('.telemetry')).not.toContainText('SHOTS FIRED 0000');
});
