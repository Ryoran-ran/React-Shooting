import { expect, test } from '@playwright/test';

test('Phase 4 combat effects stay responsive with enemies and continuous fire', async ({ page }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '戦闘練習', exact: true }).click();
  await page.getByRole('switch', { name: '敵の攻撃', exact: true }).click();
  await page.keyboard.down('Shift');
  await page.keyboard.down('z');
  await page.waitForTimeout(2600);
  await expect(page.locator('.panel-bottom-note')).toContainText(/ENEMIES [1-9]/);
  const frameTimes = await page.evaluate(async () => {
    const samples: number[] = [];
    await new Promise<void>((resolve) => {
      let first = 0;
      let previous = 0;
      const frame = (now: number) => {
        if (!first) first = now;
        if (previous) samples.push(now - previous);
        previous = now;
        if (now - first >= 3500) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return samples;
  });
  await page.keyboard.up('z');
  await page.keyboard.up('Shift');
  frameTimes.sort((a, b) => a - b);
  const median = frameTimes[Math.floor(frameTimes.length / 2)];
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
  console.log(`Phase 4 combat: ${frameTimes.length} frames / 3.5 s, median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
  expect(frameTimes.length).toBeGreaterThan(100);
  expect(median).toBeLessThan(35);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/blue-current-phase4-combat.png' });
});
