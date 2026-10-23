import { expect, test, type Page } from '@playwright/test';

async function openCombat(page: Page) {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'リセット', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '戦闘練習', exact: true }).click();
  if (await page.getByRole('dialog', { name: 'ポーズ中' }).isVisible()) {
    await page.getByRole('button', { name: '泳ぎを再開 →' }).click();
  }
  await expect(page.getByRole('switch', { name: '敵との戦闘', exact: true })).toHaveAttribute('aria-checked', 'true');
}

test('a squid explodes on contact without counting as a shot defeat', async ({ page }) => {
  await openCombat(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  await page.getByRole('switch', { name: '敵の攻撃', exact: true }).click();
  await page.clock.runFor(12000);
  const log = page.locator('.event-box');
  let hpBeforeContact = await page.locator('.hp-segments').getAttribute('aria-label');
  for (let i = 0; i < 70 && !(await log.innerText()).includes('接触して爆発'); i++) {
    hpBeforeContact = await page.locator('.hp-segments').getAttribute('aria-label');
    await page.clock.runFor(100);
  }
  await expect(log).toContainText('ヤリイカが接触して爆発！');
  // Other enemy bodies may have made contact earlier; measure this collision's damage.
  const previousHp = Number(hpBeforeContact?.match(/^HP (\d+)/)?.[1]);
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', `HP ${previousHp - 1} / 10`);
  await expect(page.locator('.telemetry')).toContainText('DEFEATED 00');
  await page.clock.runFor(100);
  await page.screenshot({ path: 'artifacts/blue-current-squid-explosion.png' });
});

test('enemies spawn, homing defeats them, combat pauses, and practice mode is preserved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openCombat(page);
  await page.clock.runFor(2400);
  await expect(page.locator('.panel-bottom-note')).toContainText(/ENEMIES [1-9]/);
  await page.keyboard.down('Shift');
  await page.keyboard.down('z');
  await page.clock.runFor(8000);
  await expect(page.locator('.telemetry')).toContainText(/DEFEATED 0[1-9]/);
  await page.screenshot({ path: 'artifacts/blue-current-combat.png' });
  await page.keyboard.up('z');
  await page.keyboard.up('Shift');

  await page.keyboard.press('Escape');
  const time = await page.locator('.time-number').innerText();
  const hostiles = await page.locator('.panel-bottom-note').innerText();
  await page.clock.runFor(4000);
  expect(await page.locator('.time-number').innerText()).toBe(time);
  expect(await page.locator('.panel-bottom-note').innerText()).toBe(hostiles);
  await page.keyboard.press('Escape');
  await page.getByRole('switch', { name: '敵の攻撃', exact: true }).click();
  await expect(page.locator('.panel-bottom-note')).toContainText('HOSTILE SHOTS 0');

  await page.getByRole('switch', { name: '敵との戦闘', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'ターゲットを表示', exact: true })).toBeVisible();
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 10 / 10');
  await page.clock.runFor(5000);
  await expect(page.locator('.panel-bottom-note')).toContainText('ALL SYSTEMS CALM');
  await page.screenshot({ path: 'artifacts/blue-current-practice.png' });
  expect(errors).toEqual([]);
});

test('taking hits updates HP, reaching zero stops the battle, and retry resets it', async ({ page }) => {
  test.setTimeout(60000);
  await openCombat(page);
  // Pause the browser clock between explicit advances so the short fall can be inspected.
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  await page.clock.runFor(18000);
  await expect(page.locator('.hp-segments')).not.toHaveAttribute('aria-label', 'HP 10 / 10');
  await page.screenshot({ path: 'artifacts/blue-current-enemies.png' });
  const over = page.getByRole('dialog', { name: 'ゲームオーバー' });
  for (let i = 0; i < 300; i++) {
    const hp = await page.locator('.hp-segments').getAttribute('aria-label');
    if (hp === 'HP 0 / 10') break;
    await page.clock.runFor(hp === 'HP 1 / 10' ? 100 : 1000);
  }
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 0 / 10');
  await expect(over).not.toBeVisible();
  const time = await page.locator('.time-number').innerText();
  const position = await page.locator('.field-bottom > span').first().innerText();
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(300);
  await expect(over).not.toBeVisible();
  await page.screenshot({ path: 'artifacts/blue-current-falling.png' });
  await page.clock.runFor(1300);
  await expect(over).toBeVisible();
  await page.keyboard.up('ArrowRight');
  expect(await page.locator('.field-bottom > span').first().innerText()).toBe(position);
  await page.clock.runFor(3000);
  expect(await page.locator('.time-number').innerText()).toBe(time);
  await page.screenshot({ path: 'artifacts/blue-current-game-over.png' });
  await page.getByRole('button', { name: 'リトライ →' }).click();
  await expect(over).not.toBeVisible();
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 10 / 10');
  await expect(page.getByRole('progressbar', { name: '回復ゲージ' })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.telemetry')).toContainText('DEFEATED 00');
});
